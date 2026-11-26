import { db, check } from './services/backend.js';
import { GAME_CATALOG } from './data/lesson.js';

const $ = id => document.getElementById(id);
const status = $('status');
const challenges = new Set(GAME_CATALOG.map(game => game.id));
let rows = [];
let students = [];

const node = (tag, text) => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  return element;
};

async function load() {
  const client = await db();
  const { data } = await client.auth.getSession();
  if (!data.session) return;

  const teacher = check(await client.from('teachers').select('id').eq('id', data.session.user.id).maybeSingle());
  if (!teacher) throw Error('Không có quyền giáo viên');

  students = check(await client.from('students').select('*'));
  rows = check(await client.from('game_attempts').select('*').order('started_at', { ascending: false }))
    .filter(attempt => challenges.has(attempt.challenge));
  $('login').hidden = true;
  $('dashboard').hidden = false;

  const filter = $('filter');
  filter.replaceChildren(new Option('Tất cả', ''));
  students.forEach(student => filter.add(new Option(student.display_name, student.id)));
  render();
}

function accuracy(attempt) {
  const firstAttempts = attempt.results.filter(result => result.try === 1);
  return firstAttempts.length
    ? `${Math.round(firstAttempts.filter(result => result.correct).length / firstAttempts.length * 100)}%`
    : '—';
}

function render() {
  const root = $('results');
  root.replaceChildren();

  for (const student of students.filter(item => !$('filter').value || item.id === $('filter').value)) {
    const card = node('section');
    card.className = 'game-card';
    card.style.cssText = 'text-align:left;margin:16px 0';
    card.append(node('h2', `${student.display_name} · ${student.class_name}`));

    const attempts = rows.filter(attempt => attempt.student_id === student.id);
    const completed = new Set(
      attempts
        .filter(attempt => attempt.completed_at && challenges.has(attempt.challenge))
        .map(attempt => attempt.challenge)
    );
    card.append(node('p', `Hoàn thành ${completed.size}/${GAME_CATALOG.length} challenge`));

    for (const attempt of attempts) {
      const details = node('details');
      details.style.margin = '12px 0';
      details.append(node('summary', `${attempt.challenge} · ${new Date(attempt.started_at).toLocaleString()} · ${attempt.completed_at ? 'Hoàn thành' : 'Đang làm'} · ${accuracy(attempt)} đúng lần đầu`));

      for (const result of attempt.results) {
        details.append(node('p', `${result.round}. ${result.question} | ${result.answer} → ${result.expected} ${result.correct ? '✓' : '✗'} (lần ${result.try})`));
      }

      card.append(details);
    }

    root.append(card);
  }
}

$('login').onsubmit = async event => {
  event.preventDefault();
  try {
    const form = new FormData(event.target);
    check(await (await db()).auth.signInWithPassword({
      email: String(form.get('email') || '').trim(),
      password: String(form.get('password') || '')
    }));
    await load();
  } catch (error) {
    status.textContent = friendlyLoginError(error.message);
  }
};

function friendlyLoginError(error) {
  const message = String(error?.message || error || '').toLowerCase()
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (message.includes('invalid login credentials')) return 'Tài khoản admin chưa đúng mật khẩu, hoặc chưa tạo tài khoản admin@alphabet.local trong Supabase.';
  if (message.includes('email not confirmed')) return 'Tài khoản admin chưa được xác nhận. Hãy bật Auto Confirm trong Supabase Auth.';
  if (message.includes('không có quyền giáo viên')) return 'Tài khoản đã đăng nhập nhưng chưa có UUID trong bảng public.teachers.';
  if (message.includes('supabase chưa được cấu hình')) return 'Chưa cấu hình Supabase URL và Publishable Key.';
  return message;
}

$('filter').onchange = render;
$('refresh').onclick = () => load().catch(error => status.textContent = friendlyLoginError(error));
$('logout').onclick = async () => {
  await (await db()).auth.signOut();
  location.reload();
};
$('export').onclick = () => {
  const cell = value => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`;
  const csv = [
    ['student', 'challenge', 'started', 'completed', 'accuracy', 'score'],
    ...rows
      .filter(attempt => !$('filter').value || attempt.student_id === $('filter').value)
      .map(attempt => [
        students.find(student => student.id === attempt.student_id)?.display_name,
        attempt.challenge,
        attempt.started_at,
        attempt.completed_at,
        accuracy(attempt),
        attempt.score
      ])
  ].map(row => row.map(cell).join(',')).join('\n');

  const link = node('a');
  link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv' }));
  link.download = 'alphabet-results.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

load().catch(error => status.textContent = friendlyLoginError(error));
