import {createRoot} from "react-dom/client";
import App from "./App";
import React from "react";
import "./index.css";
const root=document.getElementById("root");
const rootElement=createRoot(root);
rootElement.render(<App/>);