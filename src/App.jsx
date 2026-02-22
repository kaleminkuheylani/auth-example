import React from "react";
import "./index.css";
import Navbar from "./Components/Navbar"
import Auth from "./Pages/Auth"
import AuthCallback from "./Pages/AuthCallback"
import Login from "./Pages/Login"
import {BrowserRouter  ,Routes,Route} from "react-router-dom";
import Dashboard from "./Pages/Dashboard";
import Welcome from "./Pages/Welcome";
import Recommendation from "./Pages/Reccommendation"
import References from "./Pages/References"
import Messages from "./Components/Messages"
import ChatRoom from "./Components/ChatRoom"
import Wallet from "./Pages/Wallet"

function App(){
    
return(

       <BrowserRouter>
         <Routes>
            <Route path="/" element={<Welcome/>}/>
            <Route path="/signup" element={<Auth/>}/>
            <Route path="/login" element={<Login/>}/>
            <Route path="/auth/callback" element={<AuthCallback/>}/>
            <Route path="/recommendations" element={<Recommendation/>}/>
            <Route path="/references/:userId" element={<References/>}/>
            <Route path="/messages" element={<Messages/>}/>
            <Route path="/chat/:roomId" element={<ChatRoom/>}/>
            <Route path="/wallet" element={<Wallet/>}/>
            
            <Route path="/dashboard" element={<Dashboard/>}/>    
        </Routes>   

        </BrowserRouter>
        
    )
}
export default App;