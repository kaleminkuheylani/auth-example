import { supabase } from "./supabaseClient";


export default async function authMiddleware(req,res){
    const authHeader=req.heaeders.authorization;
    if(!authHeader){
        return res.status(409).json({message:"Unauthorized"});
    }
    const token =authHeader.replace("Bearer ", "");

    const {data:{user,session},error}=supabase.auth.getUser(token);

    if(!user || !token){
        return res.status(409).json({message:"Unauthorized"});
    }
    req.user=user;
    req.token=token;
    next();
}


}