import { expect } from 'aegir/utils/chai.js'
import sinon from 'sinon'
import pDefer from 'p-defer'
import pWaitFor from 'p-wait-for'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import type { TestSetup } from '../index.js'
import type { PubSub, PubSubOptions } from '@libp2p/interfaces/pubsub'
import type { EventMap } from './index.js'
import type { Registrar } from '@libp2p/interfaces/src/registrar'
import { mockRegistrar } from '../mocks/registrar.js'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'

const topic = 'foo'
const data = uint8ArrayFromString('bar')

export default (common: TestSetup<PubSub<EventMap>, PubSubOptions>) => {
  describe('pubsub api', () => {
    let pubsub: PubSub<EventMap>
    let registrar: Registrar

    // Create pubsub router
    beforeEach(async () => {
      registrar = mockRegistrar()

      pubsub = await common.setup({
        peerId: await createEd25519PeerId(),
        registrar,
        emitSelf: true
      })
    })

    afterEach(async () => {
      sinon.restore()
      await pubsub.stop()
      await common.teardown()
    })

    it('can start correctly', async () => {
      sinon.spy(registrar, 'register')

      await pubsub.start()

      expect(pubsub.isStarted()).to.equal(true)
      expect(registrar.register).to.have.property('callCount', 1)
    })

    it('can stop correctly', async () => {
      sinon.spy(registrar, 'unregister')

      await pubsub.start()
      await pubsub.stop()

      expect(pubsub.isStarted()).to.equal(false)
      expect(registrar.unregister).to.have.property('callCount', 1)
    })

    it('can subscribe and unsubscribe correctly', async () => {
      const handler = () => {
        throw new Error('a message should not be received')
      }

      await pubsub.start()
      pubsub.subscribe(topic)
      pubsub.addEventListener('topic', handler)

      await pWaitFor(() => {
        const topics = pubsub.getTopics()
        return topics.length === 1 && topics[0] === topic
      })

      pubsub.unsubscribe(topic)

      await pWaitFor(() => pubsub.getTopics().length === 0)

      // Publish to guarantee the handler is not called
      await pubsub.publish(topic, data)

      await pubsub.stop()
    })

    it('can subscribe and publish correctly', async () => {
      const defer = pDefer()

      await pubsub.start()

      pubsub.subscribe(topic)
      pubsub.addEventListener(topic, (evt) => {
        const msg = evt.detail
        expect(msg).to.not.eql(undefined)
        defer.resolve()
      })
      await pubsub.publish(topic, data)
      await defer.promise

      await pubsub.stop()
    })
  })
}
