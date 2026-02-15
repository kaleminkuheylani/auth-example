import { supabase } from "./supabaseClient.js";

export async function register(req,res){
    const {email,password,displayname,username}=req.body;
    const {data,error}=await supabase.from("users").insert({email,password,displayname,username})
    if(error) throw error;
    return res.status(200).json(data);
}
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    
  });

  if (error) throw error;
  return res.status(200).json(data);
}


