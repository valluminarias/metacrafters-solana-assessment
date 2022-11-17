import * as buffer from "buffer";
window.Buffer = buffer.Buffer;

import { createApp } from 'vue'
import App from './App.vue'

import "./css/style.css"

createApp(App).mount('#app')
