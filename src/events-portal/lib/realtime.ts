import { supabase } from "../../lib/supabase";

// Subscribes to a Supabase Realtime Broadcast channel and calls `onUpdate`
// for every message. Returns a cleanup function — call it on unmount.
export function subscribeToChannel(channelName: string, eventName: string, onUpdate: (payload: any) => void) {
    const channel = supabase.channel(channelName);
    channel.on("broadcast", { event: eventName }, ({ payload }) => onUpdate(payload));
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
}
