# auriga.fyi · Josh Dunlap

**CISC 480: Senior Capstone · Spring 2026 · University of St. Thomas**

This repository hosts my individual portfolio for the CISC 480 capstone. The live site lives at **[auriga.fyi](https://auriga.fyi)** (also mirrored on **[GitHub Pages](https://joshcd99.github.io/)**).

Portfolio sections, all reachable from the landing terminal. Type the command, or click below:

- **[about](https://auriga.fyi/about/)**: who I am, and a unique-combination answer to *"why should we hire you?"*
- **[skills](https://auriga.fyi/skills/)**: technical and professional competencies
- **[projects](https://auriga.fyi/projects/)**: five entries (2 CS · 2 interdisciplinary · 1 strictly outside CS), with two SOAR-structured narratives and one failure → learning → change story
- **[resume](https://auriga.fyi/resume/)**: 1-page CV (PDF + text)
- **reflection**: *the rest of this README* ↓

---

## Academic Honesty Statement

I, Josh Dunlap, affirm that the work submitted here is my own. All sources, collaborators, and external tools used in the creation of this portfolio and reflection are acknowledged. Where work was produced as part of a group project (notably the CISC 480 group capstone), my personal contribution is clearly identified in the corresponding project entry.

**Name:** Josh Dunlap  
**Class:** CISC 480: Senior Capstone  
**Section:** 02  
**Term:** Spring 2026

---

## Holistic Signature Work Reflection

### Ethical AI on the Warehouse Floor

The thing I have come to believe, over four years at the University of St. Thomas, is that the most consequential questions about the ethics of artificial intelligence are not the ones we usually argue about. They are not about chatbots, not about image generators, not about whether some future model will become dangerously general. The questions that will actually shape lives are quieter than that. They are happening at scale, right now, in the unsexy places. A warehouse picker whose scanner suggests a "more efficient" route through the building, and whose pick times feed back into a performance score. A sales engineer whose quoting tool subtly nudges them toward the higher-margin SKU. A dispatcher whose routing software hides the reasoning behind its choices. These are the places where machine learning is being deployed on the lives of workers who never signed up to be A/B-tested. Almost no one is watching.

The problem I want to spend my career working on is not "is AI good or bad." It is: **what do we owe the people on the receiving end of the software we build?** That question sits at the intersection of two disciplines I have spent serious time with at St. Thomas: **computer science** and **philosophy / ethics**. It also runs straight into the St. Thomas mission of educating "morally responsible leaders who think critically, act wisely, and work skillfully to advance the common good." Advancing the common good through software, I now believe, has less to do with which technologies we choose and more to do with whether we treat the people in the loop as collaborators or as objects to be optimized.

I did not always think this way. The failure that taught me is documented in my portfolio as **[GreenStep Challenge Admin](https://auriga.fyi/projects/greenstep/)**, our team's senior capstone for the Minnesota Pollution Control Agency. A teammate hit a "Create Challenge" bug on the deployed app: a clean schema-mismatch error in the browser console. I read the repo's migration files, saw the normalized schema they described, and shipped a fix that built on top of it. The fix died in production with *"table not found."* The repo's migration files had been silently rewritten after being applied; they described a schema that was never actually deployed. **I had built the wrong fix on top of fictional ground truth.** The lesson generalized hard: documentation is a *claim* about reality, not reality itself. That is exactly the failure mode that produces irresponsible AI. A model is a thin abstraction over a thick, messy, human world; treating the abstraction as the world produces the same class of bug at much higher stakes. I now treat schemas, specs, and model outputs the same way: claims to verify against the live system, not sources of truth to defer to.

That instinct is what made the **[GLR Integrated Shipping Platform](https://auriga.fyi/projects/distribution/)** work go differently. As Operations & Technology Lead at a multi-location industrial distributor, I built a Cloudflare Workers middleware that calls three freight brokers simultaneously, a React/Vite shipment-creation flow, a SuiteScript integration that writes carrier and cost data back to NetSuite, and a customer-facing branded tracking page. The temptation, given my CS background, was to optimize the engineering: model every workflow, automate every quote, push the obviously-correct ML solution at every bottleneck. I resisted. I walked the floor, sat with sales reps, learned what a radiant heating loop actually is. The 400-lane rate-comparison analysis that drove the engineering decisions (which broker to integrate first, which lanes Priority1 was uncompetitive on) is the same dataset now sitting on the desk of the person negotiating with the vendor: technical work producing non-technical leverage. The platform got adopted because it was built **with** the people who would use it, not **for** an abstraction of those people. That is the difference between AI that augments work and AI that erodes it.

The ethics piece of this is not an afterthought. My required St. Thomas coursework in philosophy and theology kept handing me frameworks I needed: the Catholic intellectual tradition's emphasis on the dignity of work, the philosophical literature on what we owe to people whose lives we shape without their consent, the ethics of attention and design that runs from Aristotle through to contemporary HCI. Operational AI proposals come across my desk all the time. *Can we score pickers on speed? Can we nudge customers toward the higher-margin SKU? Can we let the model decide what gets shown first?* I am now able to argue against them on more than just technical grounds. The model would be overfit and unstable, yes. But also: you would be turning workers into instruments of their own surveillance, and any productivity gain would be paid for in trust. That is a conversation I would not have known how to have without my non-CS education. CS gave me the leverage to ship. Ethics gave me a clearer sense of when not to.

**Human-Computer Interaction** is the third leg of that stool. HCI taught me that interfaces are moral artifacts: every default, every dark pattern avoided, every step of friction removed is a small ethical decision repeated millions of times. **[Ember](https://auriga.fyi/projects/ember/)**, my personal-finance tracker, is in some ways a small protest project: software for managing my own money that does not sell my transaction data, dark-pattern me into a premium tier, or aggregate me into anyone's training set. It is modest, but the principle scales.

The interpersonal half of my growth happened, in large part, on a **[FIRST Robotics](https://auriga.fyi/projects/first-robotics/)** team, though not as a competitor. I have been a **technical mentor** for FIRST since September 2019, more than six years now, teaching Java and embedded systems to high-schoolers who, for many of them, have never written code before the build season starts. FIRST is the reason I am a CS major; mentoring it is part of how I pay that down. More importantly, it is where I learned, season after season, that "the robot is built by the team that builds the team." Engineering is a team discipline before it is a technical one. The patience and stakeholder skills that let me sit with a sales engineer for an hour before writing a line of code at Great Lakes trace directly back to those Saturday mornings in a high-school shop. So does the willingness to argue about the *right* thing to build before optimizing the *thing* we are already building. That, in the end, is the same skill that distinguishes responsible AI work from reckless AI work. I do similar relationship work, in a different register, as a **Big Brothers Big Sisters** volunteer mentor: the smallest possible technology, the largest possible attention.

I do not think these questions are getting easier. Generative AI is colonizing the same unsexy operational software I work on (quote generation, inventory forecasting, sales scripts, picker routing), and the pressure to ship without thinking is enormous. St. Thomas has prepared me to keep asking the questions anyway: who benefits, who pays, who is in the room when the decision gets made, and whether the people downstream of the model would call this "good" if you handed them a microphone. After graduation I plan to keep building unsexy operational software, because that is where the leverage is. I also plan to keep pulling philosophy books off the shelf, because that is where I learned to recognize when the easy answer is the wrong one. The combination is the work.
