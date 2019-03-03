
import { NativeModules, DeviceEventEmitter } from 'react-native'

// Cheap attempt to prevent users using private functions
const PRIVATE = Math.random()

/** Handles connection to a remote TCP socket and sending/receiving data. */
export default class TCPSocket {

    /** @private Constructor */
    constructor(p) {

        // Check if private
        if (p != PRIVATE)
            throw new Error('TCPSocket constructor is private, you must not call it.')

        /** @private The native socket ID */
        this.id = -1

        /** The locally bound port */
        this.localPort = -1

        /** The remote port, if not a server socket */
        this.remotePort = -1

        /** The locally bound address */
        this.localAddress = ""

        /** The remote address, if not a server socket */
        this.remoteAddress = ""

    }

    /** 
     * Connect to a remote socket.
     * 
     * @param {string} host Hostname or IP address
     * @param {int} port Port number
     * @returns {Promise<TCPSocket>} The connected socket.
     */
    static async connect(host, port) {

        // Create native socket, get it's ID
        let info = await NativeModules.RNNetworkStack.tcpConnect(host, port)

        // Create new instance
        let socket = new TCPSocket(PRIVATE)
        socket.id = info.id
        socket.localPort = info.localPort
        socket.remotePort = info.remotePort
        socket.localAddress = info.localAddress
        socket.remoteAddress = info.remoteAddress

        // Done
        return socket

    }

    /**
     * Listen for incoming connections on the specified port.
     * 
     * @param {int} port The port to listen on. Pass 0 to pick a random port.
     * @param {string} host The IP address of the interface to listen on. Pass '0.0.0.0' for all interfaces.
     */
    static async listen(port = 0, host = '0.0.0.0') {

        // Create native socket, get it's ID
        let info = await NativeModules.RNNetworkStack.tcpListen(host, port)

        // Create new instance
        let socket = new TCPSocket(PRIVATE)
        socket.id = info.id
        socket.localPort = info.localPort
        socket.remotePort = info.remotePort
        socket.localAddress = info.localAddress
        socket.remoteAddress = info.remoteAddress
        socket.isServer = true

        // Done
        return socket

    }

    /** Close the socket */
    close() {
        return NativeModules.RNNetworkStack.tcpClose(this.id)
    }

    /**
     * Reads data from the socket. The options object can contain these keys:
     * - `until` : _(string)_ Reads data until the specified termination is found.
     * - `length` : _(int)_ Reads data until the specified number of bytes have been read.
     * - `saveTo` : _(string)_ Write the data to the specified file path, instead of returning it.
     * - `skip` : _(boolean)_ If true, the data will be skipped instead of being returned.
     * - `onProgress` : _(function(int))_ Called every so often with the amount of bytes transferred
     * 
     * @param {Object} opts Options object.
     * @returns {Promise<string>} The read data 
     */
    async read(opts = {}) {

        // Check if server
        if (this.isServer)
            throw new Error("This is a server socket. You can't use read() or write() on it.")

        // Check if user wants progress events. NOTE: This weirdness is due to React Native's inability to have 
        // multiple callbacks in a native API call.
        let eventID = null
        if (opts.onProgress) {

            // Get event ID
            if (!TCPSocket.nextEventID) TCPSocket.nextEventID = 1
            eventID = "net.read:" + (TCPSocket.nextEventID++)

            // Add listener
            DeviceEventEmitter.addListener(eventID, opts.onProgress)

        }

        // Pass request to native lib
        return NativeModules.RNNetworkStack.tcpRead(
            this.id, 
            opts.until, 
            typeof opts.length == 'number' ? opts.length : -1,
            opts.saveTo,
            !!opts.skip,
            eventID
        ).then(val => {

            // Remove listener if needed
            if (eventID)
                DeviceEventEmitter.removeListener(eventID, opts.onProgress)

            // Pass on data
            return val

        }).catch(err => {

            // Remove listener if needed
            if (eventID)
                DeviceEventEmitter.removeListener(eventID, opts.onProgress)

            // Pass on error
            throw err

        })

    }

    /**
     * Writes data to the socket. The data can be one of these types:
     * - _string_ : Converts the string to UTF-8 encoded data and sends it.
     * - _int_ : Sends the specified byte.
     * - _string_ : Sends the data in the file at the specified path. See the `file: true` option.
     * - _object_ : Specify options when sending:
     *   - `file` : _(boolean)_ If true, `data` contains the path to a file. The contents of the file will be sent over the socket.
     *   - `onProgress` : _(function(int))_ Called every so often with the amount of bytes transferred. Only applies to `file` transfers.
     * 
     * @param {string|int} data Data to send.
     * @param {Object} opts Options object.
     * @returns {Promise<string>} The read data 
     */
    async write(data, opts = {}) {

        // Check if server
        if (this.isServer)
            throw new Error("This is a server socket. You can't use read() or write() on it.")

        // Check if user wants progress events. NOTE: This weirdness is due to React Native's inability to have 
        // multiple callbacks in a native API call.
        let eventID = null
        if (opts.onProgress) {

            // Get event ID
            if (!TCPSocket.nextEventID) TCPSocket.nextEventID = 1
            eventID = "net.write:" + (TCPSocket.nextEventID++)

            // Add listener
            DeviceEventEmitter.addListener(eventID, opts.onProgress)

        }

        // Pass request to native lib
        return NativeModules.RNNetworkStack.tcpWrite(
            this.id, 
            data, 
            !!opts.file,
            eventID
        ).then(val => {

            // Remove listener if needed
            if (eventID)
                DeviceEventEmitter.removeListener(eventID, opts.onProgress)

            // Pass on data
            return val

        }).catch(err => {

            // Remove listener if needed
            if (eventID)
                DeviceEventEmitter.removeListener(eventID, opts.onProgress)

            // Pass on error
            throw err

        })

    }

    /**
     * Accept an incoming connection socket. This will block until a connection is received, or
     * until the socket is closed.
     * 
     * @returns {Promise<TCPSocket>} The new connection.
     */
    async accept() {

        // Check if server
        if (!this.isServer)
            throw new Error("This is not a server socket. You can't use accept() on it.")

        // Create native socket, get it's ID
        let info = await NativeModules.RNNetworkStack.tcpAccept(this.id)

        // Create new instance
        let socket = new TCPSocket(PRIVATE)
        socket.id = info.id
        socket.localPort = info.localPort
        socket.remotePort = info.remotePort
        socket.localAddress = info.localAddress
        socket.remoteAddress = info.remoteAddress
        socket.serverSocket = this

        // Done
        return socket

    }

}