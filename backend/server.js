import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import {  register,login } from "./userController.js";
import { createPost,getPosts } from "./postController.js";
import { getRoom,createRoom } from "./roomController.js";
import {authMiddleware} from "userMiddleware.js"


const app=express();
const PORT=process.env.PORT || 5000;

app.use(express.json())
//Middlewares
app.use(cors());
dotenv.config();
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self' http://localhost:5000"
  );
  next();
});


app.get("/register",register);
app.get("/login",login);
app.post("/posts",authMiddleware,createPost);
app.get("/room/:room_id",authMiddleware,getRoom);
app.post("/rooms",authMiddleware,createRoom)


app.listen(PORT,()=>{
   console.log(`Server is running on port ${PORT}`)     
}) 