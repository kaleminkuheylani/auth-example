import React,{ useState } from "react"

export default function Navbar(){
    const [selected,setSelected]=useState("social");
    
    return(
        <div className="h-25 w-full bg-red-500 items-center text-white font-semibold flex justify-center">
            <div className="w-[800px] justify-between flex items-center">
                <div className="text-3xl">
                    <h1 className="text-white">XianYuan</h1>
                </div>
                <div className="flex p-5 gap-5 ">
                  {/*Interests/ categories */}  
                </div>
                <div className="rounded-full w-10 h-10 flex justify-center items-center bg-indigo-700">
                    <p className="text-white">A</p>
                </div>
            </div>
        </div>
    )
}