import React from "react";
import "./index.css";
import Navbar from "./Components/Navbar"
import Auth from "./Pages/Auth"
import {BrowserRouter  ,Routes,Route} from "react-router-dom";
import Dashboard from "./Pages/Dashboard"
import Verification from "./Pages/Verification"
import FaceLogin from "./Pages/FaceLogin"
import Welcome from "./Pages/Welcome"
function App(){
    
return(

       <BrowserRouter>
         <Routes>
            <Route path="/" element={<Welcome/>}/>
            <Route path="/api/auth" element={<Auth/>}/>
            <Route path="/face-login" element={<FaceLogin/>}/>
            <Route path="/verification" element={<Verification/>}/>
            <Route path="/dashboard" element={<Dashboard/>}/>    
        </Routes>   

        </BrowserRouter>
        
    
    )
}
export default App;