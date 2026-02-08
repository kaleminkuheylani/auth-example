import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { signIn, signUp } from "./userController.js";

const app=express();
const PORT=process.env.PORT || 5000;

app.use(express.json({extended:true}))
//Middlewares
app.use(cors);
dotenv.config();

app.post("/register",signIn)
app.get("/login",signUp)

app.listen(PORT,()=>{
   console.log(`Server is running on port ${PORT}`)     
}) 