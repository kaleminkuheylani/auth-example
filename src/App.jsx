import React from "react";
import "./index.css";
import ChatRoom  from "./Pages/ChatRoomExcerpt";
import Navbar from "./Components/Navbar"
import Credentials from "./Pages/Credentials"
import {BrowserRouter  ,Routes,Route} from "react-router-dom";
import Dashboard from "./Pages/Dashboard"
function App(){
    
return(

       <BrowserRouter>
         <Routes>
            <Route path="/api/auth" element={<Credentials/>}/>
            <Route path="/dashboard" element={<Dashboard/>}/>    
        </Routes>   

        </BrowserRouter>
        
    
    )
}
export default App;