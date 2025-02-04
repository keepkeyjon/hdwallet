import {
  BTCInputScriptType,
  BTCWallet
} from './bitcoin'

import { ETHWallet } from './ethereum'
import { DebugLinkWallet } from './debuglink'
import { Transport } from './transport';

export type BIP32Path = Array<number>

export interface GetPublicKey {
  addressNList: BIP32Path,
  showDisplay?: boolean,
  scriptType?: BTCInputScriptType,
  curve: string,
  coin?: Coin
}

export interface PublicKey {
  xpub: string,
}

export interface Ping {
  msg: string,
  passphrase?: boolean,
  pin?: boolean,
  button?: boolean
}

export interface Pong {
  msg: string
}

export interface ResetDevice {
  /** Bits. Either 128 (12 words), 192 (18 words), or 256 (24 words)*/
  entropy?: 128 | 192 | 256,
  label?: string,
  passphrase?: boolean,
  pin?: boolean,
  autoLockDelayMs?: number,
  u2fCounter?: number
}

export interface RecoverDevice {
  /** Bits. Either 128 (12 words), 192 (18 words), or 256 (24 words)*/
  entropy?: 128 | 192 | 256,
  label?: string,
  passphrase?: boolean,
  pin?: boolean,
  language?: string,
  autoLockDelayMs?: number,
  u2fCounter?: number
}

export interface LoadDevice {
  /** 12, 18, or 24 word BIP39 mnemonic */
  mnemonic: string,
  /** User-identifiable device label */
  label?: string
  /** Whether passphrase protection should be enabled */
  passphrase?: boolean,
  /** pin, in plaintext */
  pin?: string,
  /** Whether to enforce checksum */
  skipChecksum?: boolean
}

export interface ExchangeType {
  /** `SignedExchangeResponse` from the `/sendamountProto2` ShapeShift endpoint, base64 encoded */
  signedExchangeResponse: string,
  withdrawalCoinName: string,
  withdrawalAddressNList: BIP32Path,
  withdrawalScriptType?: BTCInputScriptType,
  returnAddressNList: BIP32Path,
  returnScriptType?: BTCInputScriptType,
}

type CoinWallets = BTCWallet | ETHWallet | DebugLinkWallet

export type Coin = string

/**
 * Type guard for BTCWallet Support
 *
 * Example Usage:
 ```typescript
 if (supportsBTC(wallet)) {
   wallet.btcGetAddress(...)
 }
 ```
 */
export function supportsBTC(wallet: HDWallet | CoinWallets): wallet is BTCWallet {
  return (wallet as HDWallet)._supportsBTC !== undefined
}

/**
 * Type guard for ETHWallet Support
 *
 * Example Usage:
 ```typescript
 if (supportsETH(wallet)) {
   wallet.ethGetAddress(...)
 }
 ```
 */
export function supportsETH(wallet: HDWallet | CoinWallets): wallet is ETHWallet {
  return (wallet as HDWallet)._supportsETH !== undefined
}

export function supportsDebugLink(wallet: HDWallet | CoinWallets): wallet is DebugLinkWallet {
  return (wallet as HDWallet)._supportsDebugLink !== undefined
}

export abstract class HDWallet {
  _supportsBTC: boolean
  _supportsETH: boolean
  _supportsDebugLink: boolean

  _isKeepKey: boolean
  _isLedger: boolean
  _isTrezor: boolean

  transport: Transport

  /**
   * Retrieve the wallet's unique ID
   */
  public abstract async getDeviceID (): Promise<string>

  /**
   * Retrieve the wallet's vendor string.
   */
  public abstract getVendor (): string

  /**
   * Retrieve the name of the model of wallet, eg 'KeepKey' or 'Trezor One'
   */
  public abstract async getModel (): Promise<string>

  /**
   * Retrieve the device's user-assigned label.
   */
  public abstract async getLabel (): Promise<string>

  /**
   * Derive one or more xpubs.
   */
  public abstract async getPublicKeys (msg: Array<GetPublicKey>): Promise<Array<PublicKey>>

  /**
   * Check whether the device is locked.
   */
  public abstract async isLocked (): Promise<boolean>

  /**
   * Clear cached pin / passphrase, and lock the wallet.
   */
  public abstract async clearSession (): Promise<void>

  /**
   * Initialize a device session.
   */
  public abstract async initialize (): Promise<any>

  /**
   * Send a ping to the device.
   */
  public abstract async ping (msg: Ping): Promise<Pong>

  /**
   * Respond to device with the user's pin.
   *
   * For KeepKey/Trezor, this would be encoded with the PIN matrix OTP, so the
   * host cannot decipher it without actually seeing the device's screen.
   */
  public abstract async sendPin (pin: string): Promise<void>

  /**
   * Respond to device with the user's BIP39 passphrase.
   */
  public abstract async sendPassphrase (passphrase: string): Promise<void>

  /**
   * Respond to device with a character that the user entered.
   */
  public abstract async sendCharacter (charater: string): Promise<void>

  /**
   * Respond to device with a word that the user entered.
   */
  public abstract async sendWord (word: string): Promise<void>

  /**
   * Cancel an in-progress operation
   */
  public abstract async cancel (): Promise<void>

  /**
   * Erase all secrets and lock the wallet.
   */
  public abstract async wipe (): Promise<void>

  /**
   * Initialize a wiped device with brand new secrets generated by the device.
   */
  public abstract async reset (msg: ResetDevice): Promise<void>

  /**
   * Recover a wiped device with an existing BIP39 seed phrase.
   */
  public abstract async recover (msg: RecoverDevice): Promise<void>

  /**
   * Initialize a device with a raw BIP39 seed phrase in plaintext.
   *
   * **Extreme** care is needed when loading BIP39 seed phrases this way, as
   * the phrase is exposed in plaintext to the host machine. It is not
   * recommended to use this method of re-initialization except for unittests,
   * or if you really really know what you're doing on an **airgapped** machine.
   */
  public abstract async loadDevice (msg: LoadDevice): Promise<void>

  /**
   * Does the wallet need the user to enter their pin through the device?
   */
  public abstract async hasOnDevicePinEntry (): Promise<boolean>

  /**
   * Does the wallet need the user to enter their passphrase through the device?
   */
  public abstract async hasOnDevicePassphrase (): Promise<boolean>

  /**
   * Does the wallet have a screen for displaying addresses / confirming?
   */
  public abstract async hasOnDeviceDisplay (): Promise<boolean>

  /**
   * Does the wallet use a recovery method that does not involve communicating
   * with the host? Eg. for a KeepKey, this is `false` since we use Ciphered
   * Recovery, but for a Ledger it's `true` since you enter words using only
   * the device.
   */
  public abstract async hasOnDeviceRecovery (): Promise<boolean>

  /**
   * Does the device support `/sendamountProto2` style native ShapeShift
   * integration for the given pair?
   */
  public abstract async hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean>
}
