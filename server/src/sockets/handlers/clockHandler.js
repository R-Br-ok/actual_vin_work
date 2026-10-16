import { EVENTS } from '../../constants/events.js';
import { getServerTimestamp } from '../../services/clockService.js';

/**
 * NTP-style 3-way ping/pong clock synchronization handler.
 *
 * Handshake flow:
 * 1. Client emits SYNC_CLOCK with clientSendTime (t0)
 * 2. Server records serverReceiveTime (t1) and serverTransmitTime (t2)
 * 3. Client receives payload at clientReceiveTime (t3)
 *
 * Client calculations:
 * RTT = (t3 - t0) - (t2 - t1)
 * Offset theta = t1 - (t0 + RTT / 2)
 * Accurate Server Time = Client Clock + theta
 */
export function registerClockHandler(io, socket) {
  socket.on(EVENTS.SYNC_CLOCK, (data = {}, callback) => {
    const serverReceiveTime = getServerTimestamp();
    const clientSendTime = typeof data === 'number' ? data : (data.clientSendTime || Date.now());
    const serverTransmitTime = getServerTimestamp();

    const response = {
      clientSendTime,
      serverReceiveTime,
      serverTransmitTime,
    };

    // Support standard socket emit as well as ack callbacks
    socket.emit(EVENTS.SYNC_CLOCK_RESPONSE, response);
    if (typeof callback === 'function') {
      callback(response);
    }
  });
}
