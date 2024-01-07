import { useContext } from "react";
import Register from "./Register";
import { UserContext } from "./UserContext";
import Chat from "./ChatPage";

export default function Routes() {
    const {username, id} = useContext(UserContext);
    if(username) {
        return <Chat />
        //'logged in' + username;
    }
    return (
        <Register />
    )
}