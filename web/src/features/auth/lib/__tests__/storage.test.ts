import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { getLastLoginAccount, saveLastLoginAccount } from '../storage'

const nativeLocalStorage = window.localStorage

beforeEach(() => {
  nativeLocalStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: nativeLocalStorage,
  })
  nativeLocalStorage.clear()
})

describe('last login account storage', () => {
  test('saves a trimmed account and reads it back', () => {
    saveLastLoginAccount('  user@example.com  ')

    expect(getLastLoginAccount()).toBe('user@example.com')
  })

  test('does not overwrite the saved account with blank input', () => {
    saveLastLoginAccount('user@example.com')
    saveLastLoginAccount('   ')

    expect(getLastLoginAccount()).toBe('user@example.com')
  })

  test('degrades gracefully when localStorage is unavailable', () => {
    const blockedStorage = {
      clear: () => undefined,
      getItem: () => {
        throw new Error('storage blocked')
      },
      key: () => null,
      length: 0,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('storage blocked')
      },
    } satisfies Storage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: blockedStorage,
    })

    expect(() => saveLastLoginAccount('user@example.com')).not.toThrow()
    expect(getLastLoginAccount()).toBe('')
  })
})
