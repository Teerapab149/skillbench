# English script (simple version)

ใช้กับสไลด์ SkillBench-final-EN.pptx ธีรภาพพูดทุกหน้า ประโยคสั้นและคำพื้นฐาน เวลาตามบทราว 10:00 นาที (1003 คำ ถ้าพูดช้า ๆ ราว 100 คำต่อนาที)

ถ้านำเสนอช่วงเช้า เปลี่ยน "Good afternoon" เป็น "Good morning"

## 1. cover (0:40)

Good afternoon, everyone. We would like to welcome our guests from Malaysia and Indonesia.

My name is Teerapab Boonsri, and this is Teerapat Chinwuttiwong.

Today, we want to answer one question. How should we write rules for an AI, so that the AI follows them?

คำอ่าน: Indonesia (อินโดนีเซีย)

## 2. ai-today (0:35)

Most of us use chat AI, like ChatGPT. We ask a question, the AI answers, and we do the work ourselves.

But now there is a new kind of AI. Tools like Claude Code can open files, change code and run commands by themselves.

This is fast. But if the AI makes a mistake, the mistake goes straight into the real system. Let me show you an example from our study.

คำอ่าน: ourselves (อาวเวอร์เซลฟส์), commands (คอมแมนด์ส)

## 3. problem (0:45)

A user asked the AI to change the price of a V100 machine, from 20 baht to 25 baht per hour.

The AI did it correctly. The new price is 25 baht.

But this system calculates old bills with the current price. So last month's bill, which the customer already paid, changed from 200 baht to 250 baht. And nobody was told.

The AI followed the order, but it did not check the side effects.

คำอ่าน: calculates (แคลคิวเลทส์), side effects (ไซด์ อิฟเฟคส์)

## 4. two-ways (0:55)

To prevent this, teams write rules for the AI to read before it starts. There are two ways to write them.

Way one: put all the rules in one file. The AI reads the whole file every time. It is like reading the whole handbook.

Way two is called Agent Skills. The rules are split by topic. The AI first sees only a short list, like a table of contents. Then it opens only the topic it needs.

The idea is simple. If the AI does not read rules it does not need, it may follow the important rules better. But as far as we know, nobody has tested this directly.

คำอ่าน: handbook (แฮนด์บุ๊ก), table of contents (เทเบิล ออฟ คอนเทนส์)

## 5. question (0:45)

So our question is: with the same rules, written in these two ways, does the AI follow them differently?

We used one AI, Claude Sonnet 5, in four groups. One group had no rules. Two groups are our main pair, one file and Agent Skills. Both have the same 47 obligations.

The last group got the exact same text as Skills, but read all of it from the start.

Before we collected any data, we locked our decision rule on GitHub.

คำอ่าน: obligations (ออบลิเกชั่นส์), exact (อิกแซคท์)

## 6. arena (0:45)

We built a simple booking system for GPU machines, and we wrote 22 tasks. 20 of them hide a trap.

Here are three examples. Changing a price, where old bills change too. A broken report, where the easy fix is to delete data. And two rules that conflict, where a good AI should stop and ask.

Every group did every task three times. That is 264 runs.

คำอ่าน: conflict (คอนฟลิกท์), booking (บุ๊คกิ้ง)

## 7. measure (0:55)

How did we score? We let the AI finish the task. Then a program checks what it really did: the commands, the changed files, the message to the user, and the bill totals.

This table is a real result for the price task. The AI with no rules did not check the totals, and did not tell the user. It passed 6 of 9 rules. The AI with one file passed 8 of 9. It was the same in all three rounds.

If the task is not finished, the score is zero. And no person, and no other AI, gives the score.

คำอ่าน: totals (โททัลส์)

## 8. three-studies (0:45)

To be honest, our measuring tool was not good at first. We ran three studies.

In study one, missing one rule gave zero points, so all groups looked the same.

In study two, an AI that stopped to ask a question was counted as a failure, and three of our checkers were wrong.

In study three, we fixed these problems. We doubled the tasks and tested the tool first. This study gave us an answer.

คำอ่าน: honest (ออเนสท์ (ไม่ออกเสียง h)), measuring (เมเชอริ่ง)

## 9. result (1:20)

Here is the main result. One file scored 94.5. Agent Skills scored 97.2. The gap is 2.8 points.

Before the study, we set a line. If the gap is within 12.5 points, we call them equivalent. Why 12.5? Each task has about 8 critical rules. Missing one rule loses about 12.5 points. So the line means about one rule per task.

We only had 22 tasks, so the number can move. The 90 percent confidence interval is from minus 0.1 to plus 5.8. The whole range is inside the line, so they are equivalent.

Equivalent does not mean identical. What we can say clearly is this: Skills is not worse than one file. Two other analyses give the same answer.

คำอ่าน: equivalent (อีควิฟวะเลนท์), confidence interval (คอนฟิเดนซ์ อินเทอร์วัล), identical (ไอเดนทิคัล), analyses (อะนาลิซีส)

## 10. rules-matter (0:45)

The clearer difference is between having rules and having no rules.

In the two tasks where old bills change, the AI with no rules never told the user. Zero of six. Every group with rules told the user. Six of six.

This is an extra observation, not our main test. And we cannot tell if it comes from the rules themselves, or just from more text.

คำอ่าน: observation (ออบเซอร์เวชั่น), themselves (เดมเซลฟส์)

## 11. limits (0:45)

Our results have limits. We used one AI model, Thai instructions, one test system, and short rules.

Scores were almost full, so we can only say Skills is not worse. We cannot say it is better.

We did not test whether loading on demand helps, because our plan allowed that test only if the main result found a difference.

And we used Claude to help with our work. To reduce bias, a program does the scoring, the plan was locked, and all our history is public.

คำอ่าน: whether (เว็ทเธอร์), bias (ไบแอส)

## 12. takeaways (0:35)

So what can teams do? First, always give your AI rules, especially about scope and about checking impact.

Second, one file or Skills both work, so choose the one your team can maintain.

Third, if you use Skills, describe clearly when each skill should be used, and let the AI ask questions.

คำอ่าน: maintain (เมนเทน), impact (อิมแพคท์)

## 13. close (0:30)

To sum up: one file or Skills gives equivalent results, but you should have rules. The second part is an extra observation.

You can scan this QR code to see everything: the rules, the tasks, the full report and the code.

Thank you very much. We are happy to take your questions.

## Q&A

- Thank you for your question. (พูดก่อนตอบทุกครั้ง ได้เวลาคิด)
- Sorry, could you say that again slowly? (ถ้าฟังไม่ทัน)
- That is a good point. It is one of our limits, in section 6.4 of our report. (ใช้กับคำวิจารณ์ที่เป็นข้อจำกัดจริง)
- May I answer in Thai? (ถ้าคำถามยาก ตอบเป็นไทยได้)

**Why 12.5?**

Each task has about 8 critical rules. Missing one rule loses about 12.5 points. We set this line before the study, not after we saw the results.

**Why only three rounds?**

Our plan allowed two to four rounds. We stopped at three because of our usage quota, and because a fourth round would make the result only a little more precise. We decided this before we looked at the results by group, and we reported it as a deviation.

**You used Claude to test Claude. Is that biased?**

A program does all the scoring, not an AI. We locked the plan on GitHub before data collection. All our code and data are public, so anyone can check.

**Is Skills better than one file?**

We cannot say better. We can only say Skills is not worse. Scores were almost full, so a big advantage could not show.
