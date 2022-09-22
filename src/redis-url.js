// redisUrl.js is used to create IORedis connections using an URL-like connection string
// COPYRIGHT Lichun (lchrennew@126.com) 2022
// version: 1.0.0
import Redis from 'ioredis'

const serverPattern = /^(?<host>[^:]+)(:(?<port>\d+))?$/
const urlPattern = /^(?<protocol>[^:]+:)\/\/(?<pathname>[^\/?]+)[^?]*(\?(?<search>.*))?/
const defaultPort = 6379


export default class RedisURL {
    /**
     *
     * @type {Array}
     */
    #servers
    /**
     *
     * @type {URLSearchParams}
     */
    #entries
    /**
     *
     * @type {string}
     */
    #protocol
    /**
     *
     * @type {string}
     */
    #username
    /**
     *
     * @type {string}
     */
    #password
    /**
     *
     * @type {string}
     */
    #sentinelPassword

    constructor(url = process.env.REDIS_URL ?? 'redis://127.0.0.1', option = {
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
    }) {
        this.#rawUrl = url
        this.#username = option.username ?? process.env.REDIS_USERNAME
        this.#password = option.password ?? process.env.REDIS_PASSWORD
        this.#sentinelPassword = option.sentinelPassword ?? process.env.REDIS_SENTINEL_PASSWORD
        const { protocol, search, pathname } = urlPattern.exec(url).groups
        this.#entries = new URLSearchParams(search)
        const servers = pathname.split(',').map(server => {
            const { host, port = defaultPort } = serverPattern.exec(server).groups
            return {
                host,
                port: Number(port),
            }
        })
        this.#protocol = protocol
        this.#servers = servers
    }

    /**
     *
     * @type {string}
     */
    #rawUrl

    get rawUrl() {
        return this.#rawUrl
    }

    get single() {
        return [ 'redis:', 'rediss:' ].includes(this.#protocol)
    }

    get secured() {
        return [ 'rediss:', 'rediss-sentinel:', 'rediss-cluster:' ].includes(this.#protocol)
    }

    get usesSentinel() {
        return [ 'redis-sentinel:', 'rediss-sentinel:' ].includes(this.#protocol)
    }

    get clustered() {
        return [ 'redis-cluster:', 'rediss-cluster:' ].includes(this.#protocol)
    }

    #getRedisOptions() {
        const option = {}
        option.name = this.#entries.get('name')
        option.family = Number(this.#entries.get('family')) || 4
        option.path = this.#entries.get('path') || null
        option.keepAlive = Number(this.#entries.get('keepAlive')) || 0
        option.noDelay = this.#entries.get('noDelay') !== 'false'
        option.connectionName = this.#entries.get('connectionName') || null
        option.db = Number(this.#entries.get('db')) || 0
        option.dropBufferSupport = this.#entries.get('dropBufferSupport') === 'true'
        option.enableReadyCheck = this.#entries.get('enableReadyCheck') !== 'false'
        option.enableOfflineQueue = this.#entries.get('enableOfflineQueue') !== 'false'
        option.connectTimeout = Number(this.#entries.get('connectTimeout')) || 10000
        option.autoResubscribe = this.#entries.get('autoResubscribe') !== 'false'
        option.autoResendUnfulfilledCommands = this.#entries.get('autoResendUnfulfilledCommands') !== 'false'
        option.lazyConnect = this.#entries.get('lazyConnect') === 'true'
        option.keyPrefix = this.#entries.get('keyPrefix') || ''
        // option.tls = null // TLS connection support. See https://github.com/luin/ioredis#tls-options
        option.retryStrategy = () => 1000 // https://github.com/luin/ioredis#auto-reconnect
        option.maxRetriesPerRequest = Number(this.#entries.get('maxRetriesPerRequest')) || 0
        option.reconnectOnError = null // https://github.com/luin/ioredis#auto-reconnect
        option.readOnly = this.#entries.get('readOnly') === 'true'
        option.stringNumbers = this.#entries.get('stringNumbers') === 'true'
        option.enableAutoPipelining = this.#entries.get('enableAutoPipelining') === 'true'
        option.autoPipeliningIgnoredCommands = (this.#entries.get('autoPipeliningIgnoredCommands') ?? '').split(',').filter(x => x)
        option.maxScriptsCachingTime = Number(this.#entries.get('maxScriptsCachingTime')) || 60000
        return option
    }

    #getClusterOptions() {
        const option = {}
        // option.clusterRetryStrategy
        // option.dnsLookup
        option.enableOfflineQueue = this.#entries.get('enableOfflineQueue') !== 'false'
        option.enableReadyCheck = this.#entries.get('enableReadyCheck') !== 'false'
        option.scaleReads = this.#entries.get('scaleReads') || 'master'
        option.maxRedirections = Number(this.#entries.get('maxRedirections')) || 16
        option.retryDelayOnFailover = Number(this.#entries.get('retryDelayOnFailover')) || 100
        option.retryDelayOnClusterDown = Number(this.#entries.get('retryDelayOnClusterDown')) || 100
        option.retryDelayOnTryAgain = Number(this.#entries.get('retryDelayOnTryAgain')) || 100
        option.clusterRetryStrategy = () => 1000
        option.slotsRefreshTimeout = Number(this.#entries.get('slotsRefreshTimeout')) || 1000
        option.slotsRefreshInterval = Number(this.#entries.get('slotsRefreshInterval')) || 5000
        option.redisOptions = this.#getRedisOptions()
        return option
    }

    /**
     *
     * @param redis
     * @return {Cluster | Redis}
     */
    getRedis(redis = Redis) {
        if (this.usesSentinel) {
            return new redis({
                ...this.#getRedisOptions(),
                sentinels: this.#servers,
                password: this.#password,
                sentinelPassword: this.#sentinelPassword,
            })
        }
        if (this.single) {
            return new redis({
                ...this.#getRedisOptions(),
                ...this.#servers[0],
                password: this.#password,
                username: this.#username,
            })
        }
        if (this.clustered) {
            const clusterOptions = this.#getClusterOptions()
            return new redis.Cluster(this.#servers, {
                ...clusterOptions,
                redisOptions: {
                    ...clusterOptions.redisOptions,
                    password: this.#password,
                    username: this.#username,
                }
            })
        }
        throw '不支持该协议'
    }
}
