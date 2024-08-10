import { FC2LiveStream,FC2WebSocket } from "./fc2.js";
import axios from "axios";

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
        this.session = axios.create({
            withCredentials: true, // 允许发送和接收 cookies
          })
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

    async _get_hls_url(hls_info,mode){
        let p_merged = await this._merge_playlists(hls_info)
        
        
        let p_sorted = await this._sort_playlists(p_merged)
        let playlist = await this._get_playlist_or_best(p_sorted, mode)
        return {url:playlist["url"],
            playlist:playlist["mode"]
        }
    }

    async _merge_playlists(hls_info){
        let playlists=[]
        for(let name of ["playlists", "playlists_high_latency", "playlists_middle_latency"]){
            if(name in hls_info){
                playlists.push(...hls_info[name])
            }
        }
        return playlists
    }

    async _sort_playlists(merged_playlists){

        function keyMap(playlist) {
            let mode = playlist.mode;
            if (mode >= 90) {
                return mode - 90;
            }
            return mode;
        }
        
        return merged_playlists.sort((a, b) => keyMap(b) - keyMap(a));
    }

    async _get_playlist_or_best(sorted_playlists,mode){
        let playlist
        for(let p of sorted_playlists){
            if(p["mode"] == mode){
                playlist = p
            }
        }

        if (typeof playlist =='undefined'){
            for(let p of sorted_playlists){
                const {latency: p_latency} =this._format_mode(p['mode'])
                const {latency: r_latency} =this._format_mode(mode)
                if (p_latency == r_latency){
                    playlist = p
                    break
                }
            }
        }

        if (typeof playlist =='undefined'){
            playlist = sorted_playlists[0]
        }
        return playlist
    }

    async _format_mode(mode){
        function dictSearch(haystack, needle) {
            return Object.keys(haystack).find(key => haystack[key] === needle);
        }
    
        const latency = dictSearch(this.STREAM_LATENCY, mode % 10);
        const quality = dictSearch(this.STREAM_QUALITY, Math.floor(mode / 10) * 10);
    
        return { quality, latency };
    }

    async _get_mode(){
        let mode = 0
        mode += this.STREAM_QUALITY[this.params["quality"]]
        mode += this.STREAM_LATENCY[this.params["latency"]]
        return mode
    }

    async heartbeat(){
        if(this.live&&!this.live.is_online()){
            this.status=0
        }

        if(this.status==0){
            try{
                this.live = new FC2LiveStream(this.channel_id,this.session)
                if(! await this.live.is_online()){
                    throw new Error('NotOnline')
                }
                this.status = 1
                let _wsurl = await this.live.get_websocket_url()
                this.ws = new FC2WebSocket(_wsurl,this.session)
                let hls_info = await this.ws.get_hls_information()
                let mode = await this._get_mode()
                let {url:hls_url} = await this._get_hls_url(hls_info,mode)
                let resp = await this.session.get(hls_url)
                
            }catch(error){
                console.log(error);

            }
        }
        if(this.status==1){
            
        }
    }

    async _download_stream(channel_id, hls_url, fname){
        function sizeofFmt(num, suffix = "B") {
            const units = ["", "Ki", "Mi", "Gi", "Ti", "Pi", "Ei", "Zi"];
            let unit = "";
        
            for (unit of units) {
                if (Math.abs(num) < 1024.0) {
                    return `${num.toFixed(1)}${unit}${suffix}`;
                }
                num /= 1024.0;
            }
        
            return `${num.toFixed(1)}Yi${suffix}`;
        }

    }

}