import { describe, it, expect } from 'vitest'
import { resolveParamInterfaceModel, MODEL_REGISTRY } from '@/features/data-entry/models/registry'
import { DefaultParamCard } from '@/features/data-entry/models/DefaultParamCard'
import { ConcreteCompressCard } from '@/features/data-entry/models/ConcreteCompressCard'

describe('MODEL_REGISTRY', () => {
  it('default → DefaultParamCard', () => {
    expect(MODEL_REGISTRY['default']).toBe(DefaultParamCard)
  })
  it('concrete-compress → ConcreteCompressCard', () => {
    expect(MODEL_REGISTRY['concrete-compress']).toBe(ConcreteCompressCard)
  })
})

describe('resolveParamInterfaceModel', () => {
  it('已知 key 返回对应组件', () => {
    expect(resolveParamInterfaceModel('concrete-compress')).toBe(ConcreteCompressCard)
  })
  it('未知 key 回退默认', () => {
    expect(resolveParamInterfaceModel('nope')).toBe(DefaultParamCard)
  })
  it('空/undefined 回退默认', () => {
    expect(resolveParamInterfaceModel(undefined)).toBe(DefaultParamCard)
    expect(resolveParamInterfaceModel('')).toBe(DefaultParamCard)
  })
})
