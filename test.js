import axios from "axios";

let session = axios.create({
    withCredentials: true,
})
let resp = await session.post('https://www.baidu.com/')
console.log(resp.data);
