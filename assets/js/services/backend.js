import {config} from '../config/supabase.config.js';
export const online = Boolean(config.url && config.key);
let client;
export async function db(){ if(!online) throw Error('Supabase chưa được cấu hình'); if(!client){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); client=createClient(config.url,config.key,{auth:{storageKey:location.pathname.includes('teacher.html')?'alphabet-teacher':'alphabet-student'}});} return client; }
export function check(result){if(result.error) throw result.error; return result.data;}
export async function login(name) {
  const c = await db();
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!cleanName) throw Error('Vui lòng nhập tên học sinh');

  const { data: sessionData } = await c.auth.getSession();
  if (!sessionData.session) {
    const { error } = await c.auth.signInAnonymously();
    if (error) throw error;
  }

  const result = await c.rpc('create_student_for_name', { p_name: cleanName });
  return check(result);
}
export async function identity(){const c=await db(); const {data}=await c.auth.getSession(); if(!data.session)return null; return check(await c.from('students').select('*').eq('id',data.session.user.id).maybeSingle());}
export async function saveAttempt(s){const c=await db(); const u=await identity(); if(!u)throw Error('Please sign in'); check(await c.from('game_attempts').upsert({id:s.id,student_id:u.id,challenge:s.game.id,started_at:s.startedAt,completed_at:s.completedAt||null,score:s.score,rounds:s.totalRounds,results:s.results,stars:s.stars||0}));}
export async function uploadClip(s,blob,word){const c=await db(); const u=await identity(); if(!u)throw Error('Please sign in'); const ext=blob.type.includes('mp4')?'mp4':'webm'; const path=`${u.id}/${s.id}/${s.round}.${ext}`; check(await c.storage.from('speaking').upload(path,blob,{contentType:blob.type,upsert:true})); return path;}
