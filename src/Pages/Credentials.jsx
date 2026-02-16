import React from "react";
import {useState,useContext} from "react"
import { UsersContext, UsersContextUtil } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import {v4 as uuid } from "uuid";

const interests=[
  "fun","movie","tech","sport","health","series","music","economy","travel","food",
  "disney","stranger things","programming","languages","flirt"
]

function RegistrationHeader({submitted}){
  
  return(
    <div className="w-full mt-5 justify-around items-center flex">
     <div className="w-1/2  text-black p-5">
        <h1 className={`${submitted&&"border-b-2 border-red-500"} flex justify-center text-sm`}>Credentials</h1>
      </div>
      <div className=" w-1/2  p-5 text-black  ">
        <h1 className={`${!submitted&&"border-b-2 border-red-500"} flex justify-center text-sm`}>Personalization</h1>
      </div>

    </div>
    
  )
}
export default function Credentials(){
    const navigate=useNavigate();
    const {personalizations,credentials}=useContext(UsersContext);
    const [state,setState]=useState(true);
    const [user,setUser]=useState({...personalizations,...credentials});
    const [selected,setSelected]=useState(false);
    const [selectedInterests, setSelectedInterests] = useState([]);

    const toggleInterest = (interest) => {
      if (selectedInterests.includes(interest)) {
     // varsa çıkar
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
      } else {
       // yoksa ekle
      setSelectedInterests([...selectedInterests, interest]);
      }
    };
    const setText = (e) => {
      const {name,value}=e.target;
      setUser((prev) => ({
        ...prev,
        [name]: value,
      }));
    };
    
    function submitCredentials(e){
      e.preventDefault();    
        setUser({
          ...user,
          id:uuid()
        })
        
        setState(false)
        console.log(user);    
    }

      function submitPersonalizations(e) {
      e.preventDefault();

      const updatedUser = {
        ...user,
        bio: user.bio,  // controlled inputtan geliyor
        interests: selectedInterests,
        messages:[],
        references:[],
      };
      setUser(updatedUser);
      console.log("UPDATED USER:", updatedUser)
      navigate("/dashboard")
    }

    return(
      <UsersContextUtil>
      <div >
        
      <div className="flex flex-row items-center gap-4 justify-center min-h-screen ">
        {
          state?(
          <div>
            <RegistrationHeader submitted={state}/>
              <div className="flex justify-center min-h-screen items-center">
    
              <form onSubmit={submitCredentials} className="flex  flex-col space-y-4 rounded-xl shadow-lg w-[450px] h-[500px] mx-10 py-4 px-4">
 
              <h1 className="text-xl font-bold text-center text-red-600">
              Register
              </h1>
              <input
                className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
                placeholder="Kullanıcı Adı"
                onChange={setText}
                name="username"
                value={user.username}
              />
 
              <input
                className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
                placeholder="Email"
                onChange={setText}
                name="email"
                value={user.email}
              />
        
              <input
                className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
                placeholder="Şifre"
                type="password"
                onChange={setText}
                name="password"
                value={user.password}
              />
        
              <button type="submit" className="w-full rounded-md py-2 bg-red-500 hover:bg-red-600 text-white font-semibold">
                Go Ahead
              </button>
              </form>
          </div>
        </div>
          ):(
            <div className="flex flex-col w-[900px] space-y-5 justify-center items-center">
              <p className="text-2xl text-red-500">*You can share with us your personal preferences to talk with strangers</p> 
              <RegistrationHeader submitted={state}/>
              
              <form onSubmit={submitPersonalizations}>
                   <textarea
                onChange={setText}
                className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
                placeholder="Bio"    
                name="bio"
                value={user.bio}
                />
                <div className="flex w-full justify-center items-center grid-cols-4 grid gap-4">
                  {interests.map((interest, index) => {
                  const isSelected = selectedInterests.includes(interest);

                  return (
                    <div
                      key={index}
                      onClick={() => toggleInterest(interest)}
                      className={`rounded-md py-5 px-5 border border-dashed border-gray ${isSelected ? "bg-red-500 text-white" : ""}`}
                    >
                    <p className="text-sm">{interest}</p>
                    </div>
                  );
                  })}
                  </div>
                  <button type="submit" className=" mt-4 w-full rounded-md py-2 bg-red-500 hover:bg-red-600 text-white font-semibold">
                    Join
                  </button>
            </form> 
          </div>  
        )        
      }
    </div>         
  </div>
</UsersContextUtil>
)
}