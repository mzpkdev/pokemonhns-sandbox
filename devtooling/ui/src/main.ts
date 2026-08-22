import { mount } from "svelte"

import App from "./cartographer/App.svelte"
import "./cartographer/styles.css"

mount(App, { target: document.getElementById("app")! })
