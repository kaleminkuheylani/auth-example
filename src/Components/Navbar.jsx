import React,{ useState } from "react"
import {FaEnvelope, FaUser} from "react-icons/fa";

export default function Navbar(){
    return(
        <div className="h-15 w-full items-center text-white font-semibold flex justify-center">
            <div className="w-[950px] justify-between flex items-center">
                <div className="text-3xl">
                    <img
                    src="/calypso.png"
                    width={100}
                    height={100}
                    />
                </div>
                <div className="flex  gap-5 ">
                    <div className="rounded-full w-10 h-10 flex justify-center items-center bg-red-400">
                        <FaEnvelope/>
                    
                    </div>
                    <div className="rounded-full w-10 h-10 flex justify-center items-center bg-red-400">
                        <FaUser/>
                    </div>
                </div>
            </div>
        </div>
         
    )
}