import test from 'node:test'
import assert from 'node:assert/strict'
import {PROGRAMS} from '../src/assessment-catalog.js'
import {SOURCE_PROFILES,sourceProfileFor} from '../src/assessment-sources.js'

test('all assessment programmes have individually sourced programme profile',()=>{
 assert.equal(PROGRAMS.length,6)
 for(const p of PROGRAMS){
  const s=sourceProfileFor(p.id)
  assert.ok(s,`${p.id} has a programme source profile`)
  assert.ok(s.topics.length>0)
  assert.ok(s.resources.length>0)
  assert.equal(s.officialItemsIncluded,false)
  for(const r of s.resources){
   assert.match(r.url,/^https:\/\//)
   assert.ok(r.name.length>4)
  }
 }
 assert.deepEqual(Object.keys(SOURCE_PROFILES).sort(),PROGRAMS.map(p=>p.id).sort())
})
