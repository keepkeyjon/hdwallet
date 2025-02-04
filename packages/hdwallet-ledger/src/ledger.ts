import { crypto } from 'bitcoinjs-lib'
import {
  addressNListToBIP32,
  HDWallet,
  GetPublicKey,
  PublicKey,
  RecoverDevice,
  ResetDevice,
  LoadDevice,
  Coin,
  Ping,
  Pong,
  Constructor,
  makeEvent,
  WrongApp,
  SelectApp,
  ActionCancelled,
} from '@shapeshiftoss/hdwallet-core'
import { LedgerBTCWallet } from './bitcoin'
import { LedgerETHWallet } from './ethereum'
import { LedgerTransport } from './transport'
import {
  compressPublicKey,
  createXpub,
  encodeBase58Check,
  networksUtil,
  parseHexString,
  translateScriptType
} from './utils'

export function isLedger (wallet: any): wallet is LedgerHDWallet {
  return typeof wallet === 'object' && wallet._isLedger !== undefined
}

export class LedgerHDWallet extends HDWallet {
  _isLedger: boolean = true
  transport: LedgerTransport

  constructor (transport: LedgerTransport) {
    super()
    this.transport = transport
  }

  public async initialize (): Promise<any> {
    return
  }

  public async getDeviceID (): Promise<string> {
    return this.transport.deviceID
  }

  public getVendor (): string {
    return 'Ledger'
  }

  public async getModel (): Promise<string> {
    return
  }

  public async getLabel (): Promise<string> {
    return
  }

  public async isLocked (): Promise<boolean> {
    return true;
  }

  public async clearSession (): Promise<void> {
    return
  }

  // TODO: what to do with Ethereum?
  // Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
  public async getPublicKeys (msg: Array<GetPublicKey>): Promise<Array<PublicKey>> {
    const xpubs = []
    for (const getPublicKey of msg) {
      const { addressNList } = getPublicKey
      const bip32path: string = addressNListToBIP32(addressNList.slice(0, 3)).substring(2)
      const prevBip32path: string = addressNListToBIP32(addressNList.slice(0, 2)).substring(2)
      const format: string = translateScriptType(getPublicKey.scriptType) || 'legacy'
      const opts = {
        verify: false,
        format
      }
      const res1 = await this.transport.call('Btc', 'getWalletPublicKey', prevBip32path, opts)
      this.handleError(res1, 'Unable to obtain public key from device.')

      let { payload: { publicKey } } = res1
      publicKey = compressPublicKey(publicKey)
      publicKey = parseHexString(publicKey)
      let result = crypto.sha256(publicKey)

      result = crypto.ripemd160(result)
      const fingerprint: number = ((result[0] << 24) | (result[1] << 16) | (result[2] << 8) | result[3]) >>> 0

      const res2 = await this.transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
      this.handleError(res2, 'Unable to obtain public key from device.')

      publicKey = res2.payload.publicKey
      const chainCode: string = res2.payload.chainCode
      publicKey = compressPublicKey(publicKey)
      const coinType: number = parseInt(bip32path.split("/")[1], 10)
      const account: number = parseInt(bip32path.split("/")[2], 10)
      const childNum: number = (0x80000000 | account) >>> 0
      let xpub = createXpub(
        3,
        fingerprint,
        childNum,
        chainCode,
        publicKey,
        networksUtil[coinType].bitcoinjs.bip32.public
      )
      xpub = encodeBase58Check(xpub)

      xpubs.push({
        xpub
      })
    }
    return xpubs
  }

  public async hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean> {
    return false
  }

  public async hasOnDeviceDisplay (): Promise<boolean> {
    return true
  }

  public async hasOnDevicePassphrase (): Promise<boolean> {
    return true
  }

  public async hasOnDevicePinEntry (): Promise<boolean> {
    return true
  }

  public async hasOnDeviceRecovery (): Promise<boolean> {
    return true
  }

  public async loadDevice (msg: LoadDevice): Promise<void> {
    return
  }

  public async ping (msg: Ping): Promise<Pong> {
    // Ledger doesn't have this, faking response here
    return { msg: msg.msg }
  }

  public async cancel (): Promise<void> {
    return
  }

  public async recover (msg: RecoverDevice): Promise<void> {
    return
  }

  public async reset (msg: ResetDevice): Promise<void> {
    return
  }

  public async sendCharacter (character: string): Promise<void> {
    return
  }

  public async sendPassphrase (passphrase: string): Promise<void> {
    return
  }

  public async sendPin (pin: string): Promise<void> {
    return
  }

  public async sendWord (word: string): Promise<void> {
    return
  }

  public async wipe (): Promise<void> {
    return
  }

  protected handleError (result: any, message: string): void {
    if (result.success)
      return

    if (result.payload && result.payload.error) {

      // No app selected
      if (result.payload.error.includes('0x6700') ||
          result.payload.error.includes('0x6982')) {
        throw new SelectApp('Ledger', result.coin)
      }

      // Wrong app selected
      if (result.payload.error.includes('0x6d00')) {
        throw new WrongApp('Ledger', result.coin)
      }

      // User selected x instead of ✓
      if (result.payload.error.includes('0x6985')) {
        throw new ActionCancelled()
      }

      this.transport.emit(`ledger.${result.coin}.${result.method}.call`, makeEvent({
        message_type: 'ERROR',
        from_wallet: true,
        message
      }))

      throw new Error(`${message}: '${result.payload.error}'`)
    }
  }
}

export function create (transport: LedgerTransport): LedgerHDWallet {
  let LDGR: Constructor = LedgerHDWallet

  LDGR = LedgerETHWallet(LDGR)
  LDGR = LedgerBTCWallet(LDGR)

  return <LedgerHDWallet>new LDGR(transport)
}
