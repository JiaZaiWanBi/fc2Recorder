import axios from 'axios'
import qs from 'qs'
import websocket from 'ws'

export class FC2WebSocket{
    heartbeat_interval = 30
    constructor(url,session){
        this._url = url
        this._msg_id = 0
        this._last_heartbeat = 0
        this._is_ready = false
        this._is_ended = false
        this._ws = new websocket(this._url)
        this._ws.addEventListener('message',(msg) => this._receiveMessage(msg))
        this._msg_responses = new Map();
        this.session=session
    }

    async _try_heartbeat(){
        let _time = Math.floor(Date.now()/1000)
        if (_time-this._last_heartbeat < this.heartbeat_interval){
            return
        }
        this._last_heartbeat = _time
        await this._send_message("heartbeat")
    }

    async _main_loop(){
        await this._try_heartbeat()
        setTimeout(()=>this._main_loop,1000)
    }

    async _receiveMessage(message){
        let msg = JSON.parse(message.data)
        if (msg["name"] == "connect_complete"){
            this._is_ready = true
            this._main_loop()
        }else if(msg["name"] == "_response_"){
            this._msg_responses.set(msg["id"], msg)
        }
    }

    async wait_disconnection(){
        return new Promise((resolve,reject)=>{
            const check=()=>{
                if(this._is_ended){
                    resolve()
                }else{
                    setTimeout(()=>check(),1000)
                }
            }
            check()
        })
    }


    async get_hls_information(){
        let msg
        let tries = 0
        let max_tries = 5
        while (typeof msg === 'undefined' && tries<max_tries){
            msg = await this._send_message_and_wait("get_hls_information",{},0)
            tries += 1
        }
        return msg["arguments"]
    }


    async _send_message_and_wait(name,args={},timeout=0){
        let msg_id = await this._send_message(name,args)
        this._msg_responses.delete(msg_id)

        const wait_for_msg = new Promise((resolve,reject)=>{
            const check=()=>{
                if(this._msg_responses.has(msg_id)){
                    let _res = this._msg_responses.get(msg_id)
                    this._msg_responses.delete(msg_id)
                    resolve(_res)
                }else{
                    setTimeout(()=>check(),100)
                }
            }
            check()
        })
        let tasks = [wait_for_msg]
        if (timeout>0){
            const timeoutPromise = new Promise((_,reject)=>{
                setTimeout(()=>reject('Timeout'),timeout)
            })
            tasks.push(timeoutPromise)
        }
        const result = await Promise.race(tasks)
        if ( result === 'Timeout') {
            console.log("tiemout")
            return null;
        }
        return result

    }

    async _send_message(name,args={}){
        this._msg_id += 1
        let _rmsgid = this._msg_id
        const msg = {name: name, arguments: args,id:this._msg_id}
        await new Promise((resolve,reject)=>{
            const check=()=>{
                if(this._is_ready){
                    resolve()
                }else{
                    setTimeout(()=>check(), 500);
                }
            }
            check()
        })
        await this._ws.send(JSON.stringify(msg))
        try{
            await this._ws.send(JSON.stringify(msg))
        }catch{
            console.log('SendError')
        }
        return _rmsgid
    }
    

}

export class FC2LiveStream{
    constructor(channel_id,session){

            this._meta = null;
            this._cookie = null;
            this.channel_id = channel_id;
            this.session=session
    }


    async getMeta() {
        let resp
        const url = "https://live.fc2.com/api/memberApi.php"
        let data = {
            "channel": 1,
            "profile": 1,
            "user": 1,
            "streamid": this.channel_id,
          };
        try{
            resp = await this.session.post(url,qs.stringify(data))
        }catch(error){
            console.log(error);
            
        }
        this._cookie = resp.headers['set-cookie']
        return {
            meta: resp.data["data"],
            cookie: resp.headers['set-cookie']
        }
    }

    async is_online(){
        const {meta,cookie} = await this.getMeta()
        return meta["channel_data"]["is_publish"] && meta["channel_data"]["is_publish"] > 0
    }

    async get_websocket_url(){
        const {meta,cookie} = await this.getMeta()
        const url = "https://live.fc2.com/api/getControlServer.php"
        let resp
        const data = {
            "channel_id": this.channel_id,
            "mode": "play",
            "orz": "",
            "channel_version": meta["channel_data"]["version"],
            "client_version": "2.1.0\n+[1]",
            "client_type": "pc",
            "client_app": "browser_hls",
            "ipv6": "",
        }
        try{
            resp = await this.session.post(url,qs.stringify(data))
        }catch{

        }
        if(resp.data['status']!=0){
            throw new Error('NotOnline')
        }
        let jwt_body = resp.data['control_token'].split(".")[1]
        //let control_token =JSON.parse(atob(jwt_body+"=="))
        let control_token =jwt_body
        //console.log(`${url}?control_token=${qs.stringify( control_token)}`)
        return `${resp.data['url']}?control_token=${resp.data['control_token']}`

    }
}

