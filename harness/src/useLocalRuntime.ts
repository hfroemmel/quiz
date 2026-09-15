/**
 * A `LocalQuizRuntime` for the lifetime of a component.
 *
 * The harness is the host - it provides the runtime and tears it down. The
 * kiosk and the game collection do exactly the same; here it's the same
 * role, just without Electron around it.
 */
import { useEffect, useState } from 'react'
import { LocalQuizRuntime, type RulesConfig } from '@hfroemmel/quiz-core'
import { loadHarnessPackage } from './quizPackage'

export interface RuntimeHandle {
  runtime: LocalQuizRuntime | null
  errors: string | null
}

export interface RuntimeOptions {
  /**
   * Rules of the package, overwritten for this run.
   *
   * A HARNESS THING, AND ONLY ONE. In a real installation the rules come from
   * the content, where they belong - one package, one set of rules. But some of
   * them decide what the interface does, and the interface is what is tested
   * here: a suite that wants to see the details step would otherwise have to
   * turn the rule on in the shared fixture content, and thereby turn it on for
   * every other suite as well.
   */
  rules?: Partial<RulesConfig>
}

export function useLocalRuntime(options: RuntimeOptions = {}): RuntimeHandle {
  const [handle, setHandle] = useState<RuntimeHandle>({ runtime: null, errors: null })
  // A stable key, so a fresh object on every render does not rebuild the game.
  const ruleKey = JSON.stringify(options.rules ?? null)

  useEffect(() => {
    let discarded = false
    let built: LocalQuizRuntime | null = null
    const rules = JSON.parse(ruleKey) as Partial<RulesConfig> | null

    void loadHarnessPackage()
      .then((loaded) => {
        if (discarded) return
        const quizPackage = rules
          ? { ...loaded, config: { ...loaded.config, rules: { ...loaded.config.rules, ...rules } } }
          : loaded
        built = new LocalQuizRuntime({ quizPackage })
        setHandle({ runtime: built, errors: null })
      })
      .catch((cause: unknown) => {
        if (discarded) return
        setHandle({ runtime: null, errors: cause instanceof Error ? cause.message : String(cause) })
      })

    // Even a setup that's aborted during loading cleans up after itself.
    return () => {
      discarded = true
      built?.dispose()
      setHandle({ runtime: null, errors: null })
    }
  }, [ruleKey])

  return handle
}
