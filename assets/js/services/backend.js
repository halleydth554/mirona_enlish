import {config} from '../config/supabase.config.js';
export const online = Boolean(config.url && config.key);
let client;

const DEVICE_KEY = 'alphabet-adventure:device-id';
const STUDENT_KEY = 'alphabet-adventure:student';

export function getDeviceId(){
  if(typeof localStorage === 'undefined') return '';
  let id=localStorage.getItem(DEVICE_KEY);
  if(!id){
    id=typeof crypto !== 'undefined' && typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY,id);
  }
  return id;
}

export function getSavedStudent(){
  try{return JSON.parse(localStorage.getItem(STUDENT_KEY)||'null');}catch{return null;}
}

export async function db(){
  if(!online) throw Error('Supabase chưa được cấu hình');
  if(!client){
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    client=createClient(config.url,config.key,{auth:{persistSession:true,storageKey:'alphabet-supabase'}});
  }
  return client;
}
export function check(result){if(result.error) throw result.error; return result.data;}

export async function login(name) {
  const c=await db();
  const cleanName=String(name||'').trim().replace(/\s+/g,' ').slice(0,40);
  if(!cleanName) throw Error('Please enter a student name');
  const result=await c.rpc('register_student',{p_device_id:getDeviceId(),p_name:cleanName});
  if(result.error?.message?.includes('Could not find the function public.register_student')){
    throw Error('Supabase chưa có hàm register_student. Hãy chạy nội dung supabase/setup.sql trong SQL Editor, đợi vài giây rồi thử lại.');
  }
  const student=check(result);
  const value=Array.isArray(student)?student[0]:student;
  if(!value) throw Error('Could not save the student profile');
  localStorage.setItem(STUDENT_KEY,JSON.stringify(value));
  return value;
}

export async function identity(){
  const saved=getSavedStudent();
  if(saved?.id) return saved;
  const c=await db();
  const result=await c.rpc('get_student',{p_device_id:getDeviceId()});
  const student=check(result);
  const value=Array.isArray(student)?student[0]:student;
  if(value) localStorage.setItem(STUDENT_KEY,JSON.stringify(value));
  return value||null;
}

export async function logoutStudent(){
  localStorage.removeItem(STUDENT_KEY);
}

export async function saveAttempt(s){
  const c=await db();
  const u=await identity();
  if(!u) throw Error('Please sign in');
  const result=await c.rpc('save_game_attempt',{p_device_id:getDeviceId(),p_attempt:{
    id:s.id,challenge:s.game.id,started_at:s.startedAt,completed_at:s.completedAt||null,
    score:s.score,rounds:s.totalRounds,results:s.results,stars:s.stars||0
  }});
  return check(result);
}

export async function uploadClip(){
  // Browser-only recording remains local; anonymous Auth and storage uploads are disabled.
  return null;
}

export async function getProgress(){
  const c=await db();
  const result=await c.rpc('get_student_progress',{p_device_id:getDeviceId()});
  return check(result);
}
