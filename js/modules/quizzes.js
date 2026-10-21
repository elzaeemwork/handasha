/**
 * quizzes.js - الاختبارات الذاتية
 * Self-assessment quizzes with MCQ and True/False questions, scoring, and explanations.
 * @module modules/quizzes
 */

import { add, get, getAll, update, remove, getAllFromIndex } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, emptyState, loadingSpinner, progressBar } from '../utils/ui.js';
import { sanitizeHTML } from '../utils/validation.js';
import { formatScore, formatPercentage } from '../utils/formatting.js';
import { navigate } from '../router.js';

export async function render(container, params) {
  const quizId = params?.id;
  if (quizId) {
    await renderQuizDetail(container, quizId);
  } else {
    await renderQuizList(container);
  }
}

async function renderQuizList(container) {
  container.innerHTML = loadingSpinner('جاري تحميل الاختبارات...');

  async function loadData() {
    const [quizzes, questions, subjects] = await Promise.all([
      getAll('quizzes'),
      getAll('quizQuestions'),
      getAll('subjects'),
    ]);
    return { quizzes: quizzes || [], questions: questions || [], subjects: subjects || [] };
  }

  function renderView(data) {
    const { quizzes, questions, subjects } = data;
    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));

    container.innerHTML = `
      <div class="flashcards-container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الاختبارات الذاتية</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">اختبر معلوماتك بالأسئلة المتعددة والصح والخطأ</span>
          </div>
          <button id="btn-add-quiz" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
            ${icon('plus', 18)}
            <span>اختبار جديد</span>
          </button>
        </div>

        <!-- Quizzes Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 6px;">
          ${
            quizzes.length === 0
              ? emptyState(
                  'quiz',
                  'لا توجد اختبارات ذاتية',
                  'أنشئ اختباراً لمادة معينة وضع فيه أسئلة لتختبر نفسك قبل الامتحانات الحقيقية.',
                  'إنشاء اختبار ذاتي',
                  () => openQuizForm(null, data)
                )
              : quizzes
                  .map((q) => {
                    const qQuestions = questions.filter((item) => item.quizId === q.id);
                    const subj = subjectsMap.get(q.subjectId);
                    const subjName = subj ? subj.name : 'عام';
                    const subjColor = subj ? subj.color : '#f59e0b';

                    return `
                    <div class="card quiz-card" data-id="${q.id}" style="cursor: pointer; border-right: 4px solid ${subjColor}; display: flex; flex-direction: column; gap: 10px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                          <div style="font-size: 16px; font-weight: 700; color: var(--color-text);">${sanitizeHTML(q.title)}</div>
                          <span class="badge" style="background: ${subjColor}15; color: ${subjColor}; font-weight: 600; font-size: 11px; margin-top: 4px;">${sanitizeHTML(subjName)}</span>
                        </div>
                        <button class="btn btn-ghost btn-delete-quiz" data-id="${q.id}" style="padding: 4px; color: var(--color-danger);" title="حذف">
                          ${icon('trash', 16)}
                        </button>
                      </div>

                      <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary);">
                        <span>الأسئلة: <b>${qQuestions.length}</b></span>
                        ${q.lastScore !== undefined && q.lastScore !== null ? `<span style="font-weight: 700; color: var(--color-primary);">آخر نتيجة: ${q.lastScore}٪</span>` : '<span>لم يُجرّب بعد</span>'}
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    container.querySelector('#btn-add-quiz').addEventListener('click', () => {
      openQuizForm(null, data);
    });

    container.querySelectorAll('.quiz-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-quiz')) return;
        navigate(`/quizzes/${card.dataset.id}`);
      });
    });

    container.querySelectorAll('.btn-delete-quiz').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirm('حذف الاختبار', 'هل أنت متأكد من حذف هذا الاختبار وجميع أسئلته؟', 'حذف', 'إلغاء', true);
        if (ok) {
          const qId = btn.dataset.id;
          await remove('quizzes', qId);
          const qQuestions = questions.filter((item) => item.quizId === qId);
          for (const item of qQuestions) {
            await remove('quizQuestions', item.id);
          }
          toast('تم حذف الاختبار', 'success');
          const updated = await loadData();
          renderView(updated);
        }
      });
    });
  }

  function openQuizForm(quiz, data) {
    const { subjects } = data;
    const formHTML = `
      <form id="quiz-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">عنوان الاختبار *</label>
          <input type="text" name="title" placeholder="مثال: اختبار الفهم - الدوائر الكهربائية 1" required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
        </div>
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">المادة الدراسية</label>
          <select name="subjectId" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
            <option value="">(عام)</option>
            ${subjects.map((s) => `<option value="${s.id}">${sanitizeHTML(s.name)}</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    modal('إنشاء اختبار ذاتي جديد', formHTML, [
      {
        text: 'إنشاء الاختبار',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('quiz-form');
          const title = form.title.value.trim();
          if (!title) {
            toast('يرجى إدخال عنوان للاختبار', 'warning');
            return;
          }

          const newId = await add('quizzes', {
            title,
            subjectId: form.subjectId.value || '',
            lastScore: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          toast('تم إنشاء الاختبار بنجاح', 'success');
          closeFn();
          navigate(`/quizzes/${newId}`);
        },
      },
    ]);
  }

  const initialData = await loadData();
  renderView(initialData);
}

async function renderQuizDetail(container, quizId) {
  container.innerHTML = loadingSpinner('جاري تحميل تفاصيل الاختبار...');

  const quiz = await get('quizzes', quizId);
  if (!quiz) {
    toast('الاختبار غير موجود', 'error');
    navigate('/quizzes');
    return;
  }

  async function loadQuestions() {
    return (await getAllFromIndex('quizQuestions', 'quizId', quizId)) || [];
  }

  let questions = await loadQuestions();
  let mode = 'list'; // 'list' or 'taking'
  let currentQIndex = 0;
  let userScore = 0;
  let answered = false;
  let selectedOption = null;

  function renderView() {
    if (mode === 'taking') {
      renderTakingMode();
    } else {
      renderManageMode();
    }
  }

  function renderManageMode() {
    container.innerHTML = `
      <div class="flashcards-container" style="max-width: 650px; margin: 0 auto;">
        <!-- Top Toolbar -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <button id="btn-back-quizzes" class="btn btn-ghost" style="padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
            ${icon('chevron-right', 20)}
            <span>الاختبارات</span>
          </button>
          <div style="text-align: center;">
            <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: var(--color-text);">${sanitizeHTML(quiz.title)}</h3>
            <span style="font-size: 12px; color: var(--color-text-secondary);">${questions.length} أسئلة</span>
          </div>
          <button id="btn-add-question" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
            ${icon('plus', 16)}
            <span>إضافة سؤال</span>
          </button>
        </div>

        ${
          questions.length > 0
            ? `
          <button id="btn-start-quiz" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 16px; font-weight: 700; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            ${icon('play', 20)}
            <span>بدء الاختبار الآن</span>
          </button>
        `
            : ''
        }

        <!-- Questions List -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;">
          ${
            questions.length === 0
              ? emptyState(
                  'quiz',
                  'لا توجد أسئلة في هذا الاختبار',
                  'أضف أسئلة اختيار من متعدد أو صح وخطأ لتتمكن من بدء الاختبار.',
                  'إضافة أول سؤال',
                  () => openQuestionForm(null)
                )
              : questions
                  .map((q, idx) => {
                    const typeLabel = q.type === 'mcq' ? 'اختيار من متعدد' : 'صح وخطأ';
                    return `
                    <div class="card" style="display: flex; flex-direction: column; gap: 6px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div>
                          <span style="font-size: 12px; color: var(--color-text-secondary); font-weight: 600;">سؤال ${idx + 1} (${typeLabel})</span>
                          <div style="font-size: 14px; font-weight: 600; color: var(--color-text); margin-top: 2px;">${sanitizeHTML(q.question)}</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                          <button class="btn btn-ghost btn-edit-q" data-id="${q.id}" style="padding: 4px;" title="تعديل">${icon('edit', 16)}</button>
                          <button class="btn btn-ghost btn-delete-q" data-id="${q.id}" style="padding: 4px; color: var(--color-danger);" title="حذف">${icon('trash', 16)}</button>
                        </div>
                      </div>
                      <div style="font-size: 12px; color: var(--color-secondary, #24A58A);">
                        الإجابة الصحيحة: <b>${sanitizeHTML(q.correctAnswer)}</b>
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    container.querySelector('#btn-back-quizzes').addEventListener('click', () => {
      navigate('/quizzes');
    });

    const addQBtn = container.querySelector('#btn-add-question');
    if (addQBtn) addQBtn.addEventListener('click', () => openQuestionForm(null));

    const startBtn = container.querySelector('#btn-start-quiz');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        mode = 'taking';
        currentQIndex = 0;
        userScore = 0;
        answered = false;
        selectedOption = null;
        renderView();
      });
    }

    container.querySelectorAll('.btn-edit-q').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = questions.find((item) => item.id === btn.dataset.id);
        if (target) openQuestionForm(target);
      });
    });

    container.querySelectorAll('.btn-delete-q').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirm('حذف السؤال', 'هل أنت متأكد من حذف هذا السؤال؟', 'حذف', 'إلغاء', true);
        if (ok) {
          await remove('quizQuestions', btn.dataset.id);
          toast('تم حذف السؤال', 'success');
          questions = await loadQuestions();
          renderView();
        }
      });
    });
  }

  function renderTakingMode() {
    if (currentQIndex >= questions.length) {
      // Completed Screen
      const percentage = Math.round((userScore / questions.length) * 100);

      // Save score
      quiz.lastScore = percentage;
      update('quizzes', quiz);

      container.innerHTML = `
        <div class="flashcards-container" style="max-width: 500px; margin: 0 auto; text-align: center;">
          <div class="card" style="padding: 30px 20px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div style="font-size: 48px;">${percentage >= 70 ? '🏆' : percentage >= 50 ? '👍' : '📖'}</div>
            <h2 style="font-size: 22px; font-weight: 700; color: var(--color-text); margin: 0;">اكتمل الاختبار!</h2>
            <div style="font-size: 15px; color: var(--color-text-secondary);">
              النتيجة النهائية: <b>${formatScore(userScore, questions.length)}</b>
            </div>
            <div style="font-size: 32px; font-weight: 800; color: ${percentage >= 70 ? 'var(--color-secondary)' : 'var(--color-primary)'};">
              ${percentage}٪
            </div>
            <div style="display: flex; gap: 10px; width: 100%; margin-top: 10px;">
              <button id="btn-retry-quiz" class="btn btn-secondary" style="flex: 1;">إعادة الاختبار</button>
              <button id="btn-finish-quiz" class="btn btn-primary" style="flex: 1;">إنهاء ومراجعة</button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-retry-quiz').addEventListener('click', () => {
        currentQIndex = 0;
        userScore = 0;
        answered = false;
        selectedOption = null;
        renderView();
      });

      container.querySelector('#btn-finish-quiz').addEventListener('click', () => {
        mode = 'list';
        renderView();
      });

      return;
    }

    const curQ = questions[currentQIndex];
    let options = [];
    try {
      options = typeof curQ.options === 'string' ? JSON.parse(curQ.options) : curQ.options || [];
    } catch (e) {
      options = [];
    }

    container.innerHTML = `
      <div class="flashcards-container" style="max-width: 550px; margin: 0 auto;">
        <!-- Header & Progress -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <button id="btn-quit-quiz" class="btn btn-ghost btn-sm">خروج</button>
          <span style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary);">سؤال ${currentQIndex + 1} من ${questions.length}</span>
          <span style="font-size: 13px; font-weight: 700; color: var(--color-primary);">النقاط: ${userScore}</span>
        </div>

        ${progressBar(currentQIndex, questions.length, 'var(--color-primary)')}

        <!-- Question Card -->
        <div class="card" style="margin-top: 16px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
          <div style="font-size: 17px; font-weight: 700; color: var(--color-text); line-height: 1.5;">
            ${sanitizeHTML(curQ.question)}
          </div>

          <!-- Options Buttons -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${options
              .map((opt) => {
                let btnStyle = 'background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);';
                if (answered) {
                  if (opt === curQ.correctAnswer) {
                    btnStyle = 'background: #24A58A20; border-color: #24A58A; color: #24A58A; font-weight: 700;';
                  } else if (opt === selectedOption && selectedOption !== curQ.correctAnswer) {
                    btnStyle = 'background: #D9534F20; border-color: #D9534F; color: #D9534F; font-weight: 700;';
                  }
                }

                return `
                <button class="btn btn-option" data-opt="${sanitizeHTML(opt)}" ${answered ? 'disabled' : ''} 
                  style="padding: 12px 16px; text-align: right; justify-content: flex-start; font-size: 14px; border-radius: 10px; ${btnStyle}">
                  ${sanitizeHTML(opt)}
                </button>
              `;
              })
              .join('')}
          </div>

          <!-- Explanation box if answered -->
          ${
            answered && curQ.explanation
              ? `
            <div style="background: var(--color-bg); padding: 12px; border-radius: 8px; font-size: 13px; color: var(--color-text); margin-top: 4px; border-right: 3px solid var(--color-primary);">
              <b>💡 توضيح:</b> ${sanitizeHTML(curQ.explanation)}
            </div>
          `
              : ''
          }

          <!-- Next Button -->
          ${
            answered
              ? `
            <button id="btn-next-question" class="btn btn-primary" style="margin-top: 10px; padding: 12px; font-weight: 700;">
              ${currentQIndex < questions.length - 1 ? 'السؤال التالي ➔' : 'عرض النتيجة النهائية 🏆'}
            </button>
          `
              : ''
          }
        </div>
      </div>
    `;

    container.querySelector('#btn-quit-quiz').addEventListener('click', async () => {
      const ok = await confirm('إنهاء الاختبار', 'هل أنت متأكد من الخروج من الاختبار الحالي؟', 'خروج', 'متابعة');
      if (ok) {
        mode = 'list';
        renderView();
      }
    });

    container.querySelectorAll('.btn-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        selectedOption = btn.dataset.opt;
        if (selectedOption === curQ.correctAnswer) {
          userScore++;
          toast('إجابة صحيحة! أحسنت ✓', 'success', 1500);
        } else {
          toast('إجابة خاطئة ✗', 'error', 1500);
        }
        renderView();
      });
    });

    const nextBtn = container.querySelector('#btn-next-question');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentQIndex++;
        answered = false;
        selectedOption = null;
        renderView();
      });
    }
  }

  function openQuestionForm(questionToEdit) {
    const isEdit = !!questionToEdit;
    const cur = questionToEdit || {
      type: 'mcq',
      question: '',
      options: ['الخيار 1', 'الخيار 2', 'الخيار 3', 'الخيار 4'],
      correctAnswer: 'الخيار 1',
      explanation: '',
    };

    let opts = cur.options;
    if (typeof opts === 'string') {
      try {
        opts = JSON.parse(opts);
      } catch (e) {
        opts = ['صح', 'خطأ'];
      }
    }

    const formHTML = `
      <form id="question-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">نوع السؤال</label>
          <select id="form-q-type" name="type" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
            <option value="mcq" ${cur.type === 'mcq' ? 'selected' : ''}>اختيار من متعدد (4 خيارات)</option>
            <option value="trueFalse" ${cur.type === 'trueFalse' ? 'selected' : ''}>صح أو خطأ</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">نص السؤال *</label>
          <textarea name="question" rows="2" placeholder="اكتب نص السؤال هنا..." required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px; resize: vertical;">${sanitizeHTML(cur.question)}</textarea>
        </div>

        <div id="options-container" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Injected dynamically based on type -->
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">تفسير الإجابة (اختياري)</label>
          <input type="text" name="explanation" value="${sanitizeHTML(cur.explanation || '')}" placeholder="توضيح يظهر للطالب بعد الإجابة..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
        </div>
      </form>
    `;

    const m = modal(isEdit ? 'تعديل السؤال' : 'إضافة سؤال جديد', formHTML, [
      {
        text: 'حفظ السؤال',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('question-form');
          const qText = form.question.value.trim();
          const qType = form.type.value;

          if (!qText) {
            toast('يرجى كتابة نص السؤال', 'warning');
            return;
          }

          let finalOptions = [];
          let finalCorrect = '';

          if (qType === 'trueFalse') {
            finalOptions = ['صح', 'خطأ'];
            finalCorrect = form.correctAnswerTF.value;
          } else {
            const optInputs = form.querySelectorAll('.mcq-opt-input');
            const radio = form.querySelector('input[name="correctRadio"]:checked');
            finalOptions = Array.from(optInputs).map((i) => i.value.trim()).filter(Boolean);
            if (finalOptions.length < 2) {
              toast('يرجى إدخال خيارين على الأقل', 'warning');
              return;
            }
            const checkedIndex = radio ? Number(radio.value) : 0;
            finalCorrect = finalOptions[checkedIndex] || finalOptions[0];
          }

          const payload = {
            quizId,
            type: qType,
            question: qText,
            options: JSON.stringify(finalOptions),
            correctAnswer: finalCorrect,
            explanation: form.explanation.value.trim(),
            createdAt: cur.createdAt || Date.now(),
          };

          if (isEdit) {
            payload.id = questionToEdit.id;
            await update('quizQuestions', payload);
            toast('تم تعديل السؤال بنجاح', 'success');
          } else {
            await add('quizQuestions', payload);
            toast('تمت إضافة السؤال بنجاح', 'success');
          }

          closeFn();
          questions = await loadQuestions();
          renderView();
        },
      },
    ]);

    function updateOptionsUI(type) {
      const containerEl = document.getElementById('options-container');
      if (!containerEl) return;

      if (type === 'trueFalse') {
        containerEl.innerHTML = `
          <label style="display: block; font-size: 13px; font-weight: 600;">الإجابة الصحيحة:</label>
          <div style="display: flex; gap: 20px;">
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="radio" name="correctAnswerTF" value="صح" ${cur.correctAnswer !== 'خطأ' ? 'checked' : ''} />
              <span>صح</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="radio" name="correctAnswerTF" value="خطأ" ${cur.correctAnswer === 'خطأ' ? 'checked' : ''} />
              <span>خطأ</span>
            </label>
          </div>
        `;
      } else {
        const defaultOpts = opts.length >= 2 ? opts : ['الخيار 1', 'الخيار 2', 'الخيار 3', 'الخيار 4'];
        containerEl.innerHTML = `
          <label style="display: block; font-size: 13px; font-weight: 600;">الخيارات (اختر الدائرة بجانب الإجابة الصحيحة):</label>
          ${defaultOpts
            .slice(0, 4)
            .map(
              (o, i) => `
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="correctRadio" value="${i}" ${o === cur.correctAnswer || (i === 0 && !cur.correctAnswer) ? 'checked' : ''} />
              <input type="text" class="mcq-opt-input" value="${sanitizeHTML(o)}" placeholder="خيار ${i + 1}" required 
                style="flex: 1; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 13px;" />
            </div>
          `
            )
            .join('')}
        `;
      }
    }

    const typeSelect = document.getElementById('form-q-type');
    typeSelect.addEventListener('change', (e) => updateOptionsUI(e.target.value));
    updateOptionsUI(cur.type);
  }

  renderView();
}
