import React,{ createContext } from "react";

const roomContext={
    roomRules:[],
    members:0,
    roomCategory:"",// "dirty chat,clean chat,making friends,selling online,learning skill"
    description:"",
}
const usersContext={
    credentials:{
        email:"",
        password:"",
        username:"",
    },
    personalizations:{
        bio:"",
        interests:[],
    },
    messages:[],
    references:[],
}

export const UsersContext=createContext(usersContext);
export const RoomContext=createContext(roomContext);

export  function UsersContextUtil({ children }) {
    return (
        <UsersContext.Provider value={usersContext}>
            {children}
        </UsersContext.Provider>
    );
}
export  function RoomContextUtil({ children }) {
    return (
        <RoomContext.Provider value={roomContext}>
            {children}
        </RoomContext.Provider>
    );
}



