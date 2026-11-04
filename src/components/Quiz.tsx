import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import type { QuizQ } from '../data/course'
import { useProgress } from '../store/progress'

export function Quiz({ chapterId, num, questions }: { chapterId: string; num: string; questions: QuizQ[] }) {
  const answers = useProgress((s) => s.quiz)
  const answer = useProgress((s) => s.answer)
  const resetQuiz = useProgress((s) => s.resetQuiz)
  const key = (i: number) => `${chapterId}:${i}`
  const correct = questions.filter((q, i) => answers[key(i)] === q.answer).length
  const answered = questions.filter((_, i) => answers[key(i)] !== undefined).length

  return (
    <section className="quiz2" id="quiz" aria-labelledby={`quiz-h-${chapterId}`}>
      <header>
        <div>
          <span className="eyebrow-sm">Self-check · chapter {num}</span>
          <h3 id={`quiz-h-${chapterId}`}>Test what you learned</h3>
        </div>
        <div className="quiz-score" aria-live="polite">
          <b>{correct}</b>/{questions.length} correct
          {answered > 0 && (
            <button type="button" className="icon-btn sm" onClick={() => resetQuiz(chapterId + ':')} aria-label="Reset this quiz">
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </header>
      {questions.map((q, i) => {
        const a = answers[key(i)]
        const state = a === undefined ? '' : a === q.answer ? 'right' : 'wrong'
        return (
          <fieldset key={i} className={'qq2 ' + state}>
            <legend>
              <span className="qn">{i + 1}</span>
              {q.q}
            </legend>
            <div className="qopts">
              {q.options.map((o, j) => (
                <label key={j} className={(a === j ? 'picked ' : '') + (a !== undefined && j === q.answer ? 'answer' : '')}>
                  <input type="radio" name={key(i)} checked={a === j} onChange={() => answer(key(i), j)} />
                  <span>{o}</span>
                </label>
              ))}
            </div>
            {a !== undefined && (
              <div className="qfb2" role="status">
                {state === 'right' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span>
                  <b>{state === 'right' ? 'Correct.' : `Not quite — the answer is “${q.options[q.answer]}”.`}</b> {q.why}
                </span>
              </div>
            )}
          </fieldset>
        )
      })}
    </section>
  )
}
