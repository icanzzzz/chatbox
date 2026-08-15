import { getDefaultStore } from 'jotai'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  isTemporarySession,
  markSessionTemporary,
  temporarySessionIdsAtom,
  unmarkSessionTemporary,
} from './sessionAtoms'

describe('temporary session atoms', () => {
  beforeEach(() => {
    // Reset the atom to a clean state between tests.
    getDefaultStore().set(temporarySessionIdsAtom, new Set())
  })

  test('isTemporarySession returns false for unknown ids', () => {
    expect(isTemporarySession('session-1')).toBe(false)
  })

  test('markSessionTemporary registers the id', () => {
    markSessionTemporary('session-1')
    expect(isTemporarySession('session-1')).toBe(true)
    expect(isTemporarySession('session-2')).toBe(false)
  })

  test('markSessionTemporary is idempotent', () => {
    markSessionTemporary('session-1')
    markSessionTemporary('session-1')
    expect(isTemporarySession('session-1')).toBe(true)
  })

  test('unmarkSessionTemporary removes the id', () => {
    markSessionTemporary('session-1')
    markSessionTemporary('session-2')
    unmarkSessionTemporary('session-1')
    expect(isTemporarySession('session-1')).toBe(false)
    expect(isTemporarySession('session-2')).toBe(true)
  })

  test('unmarkSessionTemporary is a no-op for unknown ids', () => {
    expect(() => unmarkSessionTemporary('ghost-session')).not.toThrow()
    expect(isTemporarySession('ghost-session')).toBe(false)
  })
})
