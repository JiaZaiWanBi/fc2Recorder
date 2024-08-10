import { FC2LiveStream,FC2WebSocket } from "./fc2.js"
import { FC2LiveDL } from "./FC2LiveDL.js"


async function main(){
  const room1 = new FC2LiveDL('59889342')
  
  delay(10000)
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

main()