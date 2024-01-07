import { useContext, useEffect, useState, useRef } from "react"
import Avatar from "./Avatar";
import Logo from "./Logo";
import Contact from "./Contact";
import { UserContext } from "./UserContext";
import {uniqBy} from 'lodash'
import axios from "axios";

//err->setmessage without dupes...watch from 2:30hr
//yarn dev
//nodemon index.js:::::run mongodb cluster too in web

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [offlinePeople, setOfflinePeople] = useState({});
    const [newMessageText, setNewMessageText] = useState('');
    const {username, id, setId, setUsername} = useContext(UserContext);
    const [messages, setMessages] = useState([]);
    const divUnderMessages = useRef();
    useEffect(() => {
        connectToWs()
    }, []);

    function connectToWs() {
        const ws = new WebSocket('ws://localhost:4000');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close',() => {
            setTimeout(() => {
                connectToWs()
            }, 1000);
        })
    }


    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({userId, username}) => people[userId] = username);
        setOnlinePeople(people);
        // console.log(people);
    }

    function handleMessage(e) {
        const messageData = JSON.parse(e.data);
        if('online' in messageData) {
            showOnlinePeople(messageData.online);
        } else if('text' in messageData){
            // console.log({messageData});
            // console.log({messageData});
            if(messageData.sender === selectedUserId) {
                setMessages(prev => ([...prev, {...messageData}])) //2:49
            }
        }
    }

    function logout() {
        axios.post('/logout').then(()=>{
            setWs(null);
            setId(null);
            setUsername(null);
        })
    }

    function sendMessage(ev, file = null) {
       if(ev) ev.preventDefault();
        ws.send(JSON.stringify({
                recipient: selectedUserId,
                text: newMessageText,
                file
            }
        ))
        if(file){
            axios.get('/messages/'+selectedUserId).then(res => {
                // const {data} = res;
                setMessages(res.data);
            });
        } else {
            setNewMessageText('');
            setMessages(prev => ([...prev,{
                text: newMessageText,
                sender: id,
                recipient: selectedUserId,
                _id: Date.now(),
        }]));
        }
    }

    function sendFile(ev) {
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]); //base64 content
        reader.onload = () => {
            sendMessage(null, {
                data: reader.result,
                name: ev.target.files[0].name
            })
        }
    }

    useEffect(()=>{
        const div = divUnderMessages.current;
        if(div) {
            div.scrollIntoView({behavior: 'smooth', block: 'end'});
        }
    },[messages])


    useEffect(()=>{
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                                    .filter(p => p._id!=id)
                                    .filter(p => !Object.keys(onlinePeople).includes(p._id));

            // console.log("people", offlinePeople);
            const offlinePeople = {};
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p;
            })
            console.log("off", {offlinePeople, onlinePeople});
            setOfflinePeople(offlinePeople)
            
        })
    }, [onlinePeople])

    useEffect(() => {
        if(selectedUserId) {
            axios.get('/messages/'+selectedUserId).then(res => {
                // const {data} = res;
                setMessages(res.data);
            })
        }
    }, [selectedUserId])
    

    const onlinePeopleExclOurUser = {...onlinePeople};
    delete onlinePeopleExclOurUser[id];

    const messageWithoutDupes = uniqBy(messages, '_id');
    console.log(messageWithoutDupes);

    return (
        <div className="flex h-screen">
            <div className="bg-white-50 w-1/3 flex flex-col">
            <div className="flex-grow">
                <Logo />
                {/* {username} */}
                {Object.keys(onlinePeopleExclOurUser).map(userId => (
                    <Contact 
                        id={userId}
                        online={true}
                        username={onlinePeopleExclOurUser[userId]}
                        onClick={()=> setSelectedUserId(userId)}
                        selected={userId === selectedUserId}
                    />
                ))}
                {Object.keys(offlinePeople).map(userId => (
                    <Contact 
                        id={userId}
                        online={false}
                        username={offlinePeople[userId].username}
                        onClick={()=> setSelectedUserId(userId)}
                        selected={userId === selectedUserId}
                    />
                ))}
            </div>
            <div className="p-2 ml-6 text-center flex items-center justify-center">
                <span className="mr-3 text-sm text-gray-600 flex">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="darkred" className="w-6 h-6">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                    {username+"~"}
                </span>
                <button 
                    className="text-sm text-gray-500 bg-blue-100 py-4 px-10 border rounded-full"
                    onClick={logout}
                >logout</button>
            </div>
            </div>
            <div className="bg-blue-50 w-2/3 p-2 flex flex-col">
                <div className="flex-grow">
                    {!selectedUserId && (
                        <div className="flex h-full items-center justify-center">
                            start a conversation 🚀
                        </div>
                    )}
                    {selectedUserId && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                                {messageWithoutDupes.map(message => (
                                    <div key={message._id} className={(message.sender === id ? 'text-right': 'text-left')}>
                                        <div className={"text-left inline-block p-2 my-2 rounded-md text-sm "+(message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-500')}>
                                            {message.text}
                                            {message.file && (
                                                <div>
                                                    <a className="underline" target="_blank" href={axios.defaults.baseURL+'/uploads/'+message.file}>
                                                        {message.file}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>
                {selectedUserId && ( //2:32
                    <form className="flex gap-2" onSubmit={sendMessage}>
                    <input type='text'
                           className="bg-white border py-2 pl-4 flex-grow rounded-md" 
                           placeholder="Type ypur message here"
                           value={newMessageText}
                           onChange={ev => setNewMessageText(ev.target.value)}
                    />
                    <label type="button" className="bg-blue-500  p-2 text-white cursor-pointer rounded-lg border-blue-200">
                        <input type="file" className="hidden" onChange={sendFile}/>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>

                    </label>
                    <button type = "submit" className="bg-blue-500 p-2 text-white rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    </button>
                    </form>
                )}
            </div>
        </div>
    )
}
