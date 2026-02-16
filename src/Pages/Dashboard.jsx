import React from "react";
import Navbar from "../Components/Navbar";
import Modal from "../Components/Modal"
import Messages from "../Components/Messages"
import Social from "../Components/Social"
export default function Dashboard(){
    
    return(
        <div>
            <Navbar/>
            <div className="flex flex-row">
                 <div className="left-5 top-10 fixed ">
                     <Modal/>
                </div>
                
                 
             </div>    

        </div>
    )
}