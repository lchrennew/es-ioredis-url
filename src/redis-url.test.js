import RedisURL from './redis-url.js';
import jest from 'jest-mock'

const use = async (url, option) => {
    const redis = new RedisURL(url, option).getRedis()
    return {
        then: async f => {
            await f(redis)
            await redis.disconnect()
        },
    }
}

describe('综合', () => {
    test('默认使用环境变量REDIS_URL', () => {
        expect(new RedisURL().rawUrl).toEqual(process.env.REDIS_URL)
    })

    test('不支持的协议', async () => {
        await expect(jest.fn(async () => await use('http://localhost'))).rejects.toBe('不支持该协议')
    })
})

describe('redis单机', () => {
    test('协议采用redis或rediss', () => {
        expect(new RedisURL('redis://localhost').single).toBeTruthy()
        expect(new RedisURL('rediss://localhost').single).toBeTruthy()

        expect(new RedisURL('redis-sentinel://localhost').single).toBeFalsy()
        expect(new RedisURL('rediss-sentinel://localhost').single).toBeFalsy()

        expect(new RedisURL('redis-cluster://localhost').single).toBeFalsy()
        expect(new RedisURL('rediss-cluster://localhost').single).toBeFalsy()
    })

    test('默认端口6379', async () => {
        await use('redis://localhost').then(async redis => await expect(redis.options.port).toEqual(6379))
    })

    test('用户名默认使用环境变量REDIS_USERNAME', async () => {
        await use('redis://localhost').then(async redis => await expect(redis.options.username).toBe(process.env.REDIS_USERNAME || null))
        await use('redis://localhost', { username: '1234' }).then(async redis => await expect(redis.options.username).toEqual('1234'))
    })

    test('密码默认使用环境变量REDIS_PASSWORD', async () => {
        await use('redis://localhost').then(redis => expect(redis.options.password).toBe(process.env.REDIS_PASSWORD || null))
        await use('redis://localhost', { password: '1234' }).then(redis => expect(redis.options.password).toEqual('1234'))
    })
})

describe('redis哨兵', () => {
    test('协议采用redis-sentinel或rediss-sentinel', () => {
        expect(new RedisURL('redis-sentinel://localhost').usesSentinel).toBeTruthy()
        expect(new RedisURL('rediss-sentinel://localhost').usesSentinel).toBeTruthy()
        expect(new RedisURL('redis://localhost').usesSentinel).toBeFalsy()
        expect(new RedisURL('rediss://localhost').usesSentinel).toBeFalsy()
        expect(new RedisURL('redis-cluster://localhost').usesSentinel).toBeFalsy()
        expect(new RedisURL('rediss-cluster://localhost').usesSentinel).toBeFalsy()
    })

    test('必须提供master的名字', async () => {
        await expect(jest.fn(async () => await use('redis-sentinel://localhost'))).rejects.toThrow('Requires the name of master.')
    })

    test('密码使用环境变量REDIS_SENTINEL_PASSWORD', async () => {
        await use('redis-sentinel://localhost?name=mymaster')
            .then(redis => expect(redis.options.sentinelPassword).toEqual(process.env.REDIS_SENTINEL_PASSWORD))
        await use('redis-sentinel://localhost?name=mymaster', { password: '1234' })
            .then(redis => expect(redis.options.sentinelPassword).toEqual('1234'))
    })
})

describe('redis集群', () => {
    test('协议采用redis-cluster或rediss-cluster', () => {
        expect(new RedisURL('redis://localhost').clustered).toBeFalsy()
        expect(new RedisURL('rediss://localhost').clustered).toBeFalsy()

        expect(new RedisURL('redis-sentinel://localhost').clustered).toBeFalsy()
        expect(new RedisURL('rediss-sentinel://localhost').clustered).toBeFalsy()

        expect(new RedisURL('redis-cluster://localhost').clustered).toBeTruthy()
        expect(new RedisURL('rediss-cluster://localhost').clustered).toBeTruthy()
    })

    test('集群', async () => {
        await use('redis-cluster://localhost').then(redis => expect(redis.options.scaleReads).toEqual('master'))
    })

    test('集群密码',async ()=>{
        await use('redis-cluster://localhost').then(async redis => await expect(redis.options.redisOptions.password).toBe(process.env.REDIS_PASSWORD || null))
    })
})

describe('安全协议', () => {
    test('rediss/rediss-sentinel/rediss-cluster都是安全协议', () => {
        expect(new RedisURL('rediss://localhost').secured).toBeTruthy()
        expect(new RedisURL('rediss-sentinel://localhost').secured).toBeTruthy()
        expect(new RedisURL('rediss-cluster://localhost').secured).toBeTruthy()
    })

    test('redis/redis-sentinel/redis-cluster不是安全协议', () => {
        expect(new RedisURL('redis://localhost').secured).toBeFalsy()
        expect(new RedisURL('redis-sentinel://localhost').secured).toBeFalsy()
        expect(new RedisURL('redis-cluster://localhost').secured).toBeFalsy()
    })
})
