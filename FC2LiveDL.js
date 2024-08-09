import { FC2LiveStream,FC2WebSocket } from "./fc2.js";

export class FC2LiveDL{
    STREAM_QUALITY = {
        "150Kbps": 10,
        "400Kbps": 20,
        "1.2Mbps": 30,
        "2Mbps": 40,
        "3Mbps": 50,
        "sound": 90,
    }
    STREAM_LATENCY = {
        "low": 0,
        "high": 1,
        "mid": 2,
    }
    DEFAULT_PARAMS = {
        "quality": "3Mbps",
        "latency": "mid",
        "threads": 1,
        "outtmpl": "%(date)s %(title)s (%(channel_name)s).%(ext)s",
        "write_chat": false,
        "write_info_json": false,
        "write_thumbnail": false,
        "wait_for_live": false,
        "wait_for_quality_timeout": 15,
        "wait_poll_interval": 5,
        "cookies_file": null,
        "remux": true,
        "keep_intermediates": false,
        "extract_audio": false,
        "trust_env_proxy": false,
        "dump_websocket": false,
    }


      

    constructor(channel_id,params={}){
        this.status = 0
        this.channel_id = channel_id
        this.params = this.DEFAULT_PARAMS
        Object.assign(this.params,params)
        this.loop()
    }

    async loop(){
        await this.heartbeat()
        setTimeout(() => {
            this.loop()
        }, 1000);
    }

    async heartbeat(){
        if(this.live&&!this.live.is_online()){
            this.status=0
        }

        if(this.status==0){
            try{
                this.live = new FC2LiveStream(this.channel_id)
                if(! await this.live.is_online()){
                    throw new Error('NotOnline')
                }
                this.status = 1
                let _wsurl = await this.live.get_websocket_url()
                this.ws = new FC2WebSocket(_wsurl)
            }catch(Error){
                console.log(Error)
            }
        }
        if(this.status==1){
            console.log(await this.ws.get_hls_information())
        }
    }

}