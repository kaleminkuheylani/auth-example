import React,{ createContext } from "react";
const value={
    theme:"dark",
    tabs:"social"
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
export const ContextValue=createContext(value);
export const UsersContext=createContext(usersContext);
export  function ContextUtil({ children }) {
    return (
        <ContextValue.Provider value={value}>
            {children}
        </ContextValue.Provider>
    );
}
export  function UsersContextUtil({ children }) {
    return (
        <UsersContext.Provider value={usersContext}>
            {children}
        </UsersContext.Provider>
    );
}




