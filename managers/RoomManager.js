const { generateRandomId } = require('../core/utils');
const Queue = require('../core/queue');


class RoomManager {
  constructor() {
    this._rooms = new Map();
    this._queues = new Map();
    this._callbacks = {};
  }

  setCallbacks(callbacks) {
    this._callbacks = callbacks;
  }

  makeRoom(uid, sid, name, icon) {
    if (this.searchByName(name)) {
      return null;
    }

    const existingRoom = this._rooms.get(uid);
    if (existingRoom !== undefined) {
      return existingRoom.rid;
    }

    // FIXME? Handle RID collisions
    const rid = generateRandomId();
    const room = new Room(rid, name, icon, uid, this._callbacks);
    this._rooms.set(rid, room);

    this.joinRoom(rid, uid, sid);

    return rid;
  }

  joinRoom(rid, uid, sid) {
    const room = this._rooms.get(rid);

    if (room && room.join(uid, sid)) {
      return room;
    }

    return null;
  }

  leaveRoom(rid, uid) {
    const room = this.getRoom(rid);
    if (room) {
      if (uid == room.owner) {
        // Owner left the room, destroy it
        room.getQueue().kill();
        this._rooms.delete(rid);
        this._callbacks.onRoomDestroyed(rid);
      } else {
        // Just leave normally
        room.leave(uid);
      }
    }
  }

  searchByName(name) {
    return this.getRooms().find((room) => room.name == name);
  }

  getRoom(rid) {
    return this._rooms.get(rid);
  }

  getRooms() {
    const rooms = [];

    for (const [rid, room] of this._rooms) {
      rooms.push({
        name: room.name,
        icon: room.icon,
        rid
      });
    }

    return rooms;
  }

  disconnectSocket(sid) {
    for (const [rid, room] of this._rooms) {
      const uid = room.getUidForSocket(sid);

      if (uid) {
        this.leaveRoom(rid, uid);
      }
    }
  }
}

class Room {
  constructor(rid, name, icon, ownerUid, callbacks) {
    this.name = name;
    this.icon = icon;
    this.owner = ownerUid;
    this._queue = new Queue(rid, callbacks);
    this._djs = [ ownerUid ];
    this._users = [];
    this._userSockets = new Map();
  }

  join(uid, sid) {
    if (!this._users.includes(uid)) {
      this._users.push(uid);
      this._userSockets.set(sid, uid);

      return true;
    }

    return false;
  }

  leave(uid) {
    if (this._users.includes(uid)) {
      // Remove them from the user list
      const index = this._users.indexOf(uid);
      this._users.splice(index, 1);

      // Delete the reference to their SocketID
      for (const [sid, userId] of this._userSockets) {
        if (userId == uid) {
          this._userSockets.delete(sid);
        }
      }

      // Delete their sink from our queue
      this._queue.removeSink(uid);
    }
  }

  getUidForSocket(sid) {
    return this._userSockets.get(sid);
  }

  getQueue() {
    return this._queue;
  }

  isDJ(uid) {
    return uid == this.owner || this._djs.includes(uid);
  }
}

module.exports = new RoomManager();
