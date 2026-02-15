import { supabase } from "./supabaseClient.js";

export async function createPost(res,req){
    const {title,content,desc}=req.body;
    const user=req.user;
    const post={
        title,
        content,
        desc,
        user_id:user.id,
        username:user.username  
    }

    const {data,error}=await supabase.from("social-chat-posts").insert(post);
    if(error) throw error;
    return res.status(200).json(data);
}

export async function getPosts(req,res){
    const {data,error}=await supabase.from("social-chat-posts").select("*");
    return res.status(201).json({data});
}
export async function deletePost(id){
    const {data,error}=await supabase.from("social-chat-posts").delete().eq("id",id);
    if(error) throw error;
    return res.status(200).json(data);
}
export async function updatePost(id){
    const {data,error}=await supabase.from("social-chat-posts").update().eq("id",id);
    if(error) throw error;
    return res.status(200).json(data);
}export async function getPost(id){
    const {data,error}=await supabase.from("social-chat-posts").select("*").eq("id",id);
    if(error) throw error;
    return res.status(200).json(data);
      
}    
