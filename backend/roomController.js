import {supabase} from "./supabaseClient.js";
import {v4 as uuid} from "uuid";
export async function createRoom(req,res){
    try{
        const {topic}=req.body;
        const user=req.user;
        const room_owner=await supabase.from("users").eq("id",user.id).select("username").single();
        const room={
           id:uuid(),
           topic,
           memebers:0,
           room_owner,
           messages:[],
        }
        const {data,error}=await supabase.from("social-rooms").insert(room);
        if(error){
            res.status(400).json({message:error.message});
        }
        console.log(data);
        return res.status(201).json({data})
    }catch(err){
        return res.status(400).json({message:err.message});
    }
}

}
export async function getRoom(req, res) {
    

    const { room_id } = req.params;

    const { data, error } = await supabase
        .from("social-rooms")
        .select("*")
        .eq("room_id", room_id)
        .single();
    console.log(data);

    if (error) {
        return res.status(400).json({ message: error.message });
    }
    

    return res.status(200).json(data);
}

