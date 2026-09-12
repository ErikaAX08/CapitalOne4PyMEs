# SME fragility engine evaluation
Implementation and experiments run on 12 September 2026. The reference model is the chat version; TDA, learned Bayesian propagation and the MD collapse probabilities are excluded from the main computation. New code, not an exact replica of the previous experiment.

## What we can actually present

**CatBoost is a promising candidate for ranking bankruptcy risk on benchmarks. The box engine identifies gaps and compares actions across synthetic scenarios. We have not demonstrated real payroll anticipation, calibration in Mexico, or the effectiveness of recommendations at real companies.**

Every seed was fixed in advance and is published. "Best results" means the most solid and useful evidence, not picking the highest test figure.

## 1. Predictive evidence: phase 1

### Poland — one-year bankruptcy

Original records: 5,910; clean: 5,850; events: 408; duplicates removed: 60; conflicting rows: 0.

| Seed | Model selected on validation | CatBoost AP | Logistic AP | CatBoost ROC-AUC | 95% CI ΔAP vs logistic |
| --- | --- | --- | --- | --- | --- |
| 17 | cat_d6_plus6 | 0.838 | 0.685 | 0.962 | [0.062, 0.236] |
| 42 | cat_d4_plus6 | 0.845 | 0.691 | 0.970 | [0.076, 0.239] |
| 2026 | cat_d4_plus6 | 0.814 | 0.724 | 0.962 | [0.022, 0.156] |

AP means Average Precision: it summarizes the ranking of rare events; it is not a "hit rate". The approximate reference for a random ranking is prevalence, but comparing AP across countries requires accounting for different prevalences, variables and labels.

**Alert policies with thresholds fixed on validation:**

| Seed | Validation budget | Test alerts | Events detected | Alert precision | False alerts | Missed events |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | 5% | 67/1170 (5.7%) | 58/82 (70.7%) | 86.6% | 9 | 24 |
| 17 | 10% | 114/1170 (9.7%) | 66/82 (80.5%) | 57.9% | 48 | 16 |
| 42 | 5% | 67/1170 (5.7%) | 58/82 (70.7%) | 86.6% | 9 | 24 |
| 42 | 10% | 122/1170 (10.4%) | 69/82 (84.1%) | 56.6% | 53 | 13 |
| 2026 | 5% | 49/1170 (4.2%) | 45/82 (54.9%) | 91.8% | 4 | 37 |
| 2026 | 10% | 148/1170 (12.6%) | 71/82 (86.6%) | 48.0% | 77 | 11 |

Cleaning reproduces 5,850 records, but finds 60 duplicates and no exact vector with contradictory labels. This result does not corroborate the earlier explanation of "duplicates and conflicts". Clean prevalence is 408/5,850; each new test set contains 82 events, against the 81 of the supplied matrix.

### Taiwan — independent benchmark, retrained model

Original records: 6,819; clean: 6,819; events: 220; duplicates removed: 0; conflicting rows: 0.

| Seed | Model selected on validation | CatBoost AP | Logistic AP | CatBoost ROC-AUC | 95% CI ΔAP vs logistic |
| --- | --- | --- | --- | --- | --- |
| 17 | cat_d6_raw | 0.437 | 0.408 | 0.954 | [-0.098, 0.159] |
| 42 | cat_d4_raw | 0.530 | 0.390 | 0.956 | [0.016, 0.238] |
| 2026 | cat_d4_raw | 0.534 | 0.336 | 0.960 | [0.064, 0.318] |

AP means Average Precision: it summarizes the ranking of rare events; it is not a "hit rate". The approximate reference for a random ranking is prevalence, but comparing AP across countries requires accounting for different prevalences, variables and labels.

**Alert policies with thresholds fixed on validation:**

| Seed | Validation budget | Test alerts | Events detected | Alert precision | False alerts | Missed events |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | 5% | 85/1364 (6.2%) | 30/44 (68.2%) | 35.3% | 55 | 14 |
| 17 | 10% | 149/1364 (10.9%) | 36/44 (81.8%) | 24.2% | 113 | 8 |
| 42 | 5% | 68/1364 (5.0%) | 28/44 (63.6%) | 41.2% | 40 | 16 |
| 42 | 10% | 119/1364 (8.7%) | 35/44 (79.5%) | 29.4% | 84 | 9 |
| 2026 | 5% | 87/1364 (6.4%) | 33/44 (75.0%) | 37.9% | 54 | 11 |
| 2026 | 10% | 145/1364 (10.6%) | 36/44 (81.8%) | 24.8% | 109 | 8 |

This trial uses 95 Taiwanese variables and retrains CatBoost there. **It is not a transfer of the frozen Polish model to another country.** Neither the definition nor the scale of the variables has been harmonized, and no annual horizon is claimed for this label. The AP advantage over logistic regression has a CI crossing zero at seed 17.

The three random test sets overlap; they are not three independent samples. Their intervals resample rows of the test set with the model fixed, and do not reflect training variation or repeated companies we cannot identify. The phase 1 test sets were not used in their tuning, but Poland was already a benchmark known to the project. They do not constitute new temporal validation.

### Calibration: not hiding an unfavourable result

| Dataset | Seed | Uncalibrated Brier | Sigmoid Brier | Uncalibrated log-loss | Sigmoid log-loss |
| --- | --- | --- | --- | --- | --- |
| polish | 17 | 0.02298 | 0.02330 | 0.09275 | 0.09097 |
| polish | 42 | 0.02317 | 0.02493 | 0.08701 | 0.09316 |
| polish | 2026 | 0.02705 | 0.02710 | 0.09938 | 0.09900 |
| taiwan | 17 | 0.02388 | 0.02379 | 0.08558 | 0.08203 |
| taiwan | 42 | 0.02136 | 0.02128 | 0.07704 | 0.07691 |
| taiwan | 2026 | 0.02046 | 0.02038 | 0.07390 | 0.07488 |

Lower Brier/log-loss is better, but Brier mixes calibration and discrimination: on its own it does not demonstrate calibrated probabilities. In Poland the sigmoid worsens Brier across all three splits. Reliability curves and per-band intervals are saved; some have few events. It is not correct to claim that an estimated risk of 20% already materializes 20% of the time.

### Did the six interactions contribute?

| Seed | Best raw per validation | Raw test AP | Best +6 per validation | +6 test AP |
| --- | --- | --- | --- | --- |
| 17 | cat_d4_raw | 0.840 | cat_d6_plus6 | 0.838 |
| 42 | cat_d4_raw | 0.838 | cat_d4_plus6 | 0.845 |
| 2026 | cat_d4_raw | 0.811 | cat_d4_plus6 | 0.814 |

The new formulas are fixed in the protocol. We do not know the six from the previous experiment; no claim of reproducing them is made. The comparison is a benchmark ablation, not proof that the interactions represent causal mechanisms.

## 2. Missing data and exploratory mitigation

Hiding cells at random, with the alert threshold held fixed, exposes a severe fragility in phase 1. CatBoost's native NaN handling does not guarantee robustness against a missingness pattern different from the one seen in training.

| Dataset | Seed | Clean AP | AP at 10% hidden | Alerts at 10% hidden | AP at 30% hidden |
| --- | --- | --- | --- | --- | --- |
| polish | 17 | 0.838 | 0.491 | 32.1% | 0.338 |
| polish | 42 | 0.845 | 0.446 | 29.8% | 0.273 |
| polish | 2026 | 0.814 | 0.399 | 35.5% | 0.257 |
| taiwan | 17 | 0.437 | 0.431 | 16.9% | 0.324 |
| taiwan | 42 | 0.530 | 0.361 | 18.4% | 0.271 |
| taiwan | 2026 | 0.534 | 0.480 | 16.8% | 0.352 |

Phase 2 trains on the original sample plus two copies with 10% and 30% of values hidden; the copies are not new companies. It recomputes the interactions and preserves the splits. It compares no calibration, clean sigmoid and mixed sigmoid using only validation log-loss with equal weights across the three missingness levels.

| Dataset | Seed | Calibration chosen | Clean AP | AP 10% hidden | AP 30% hidden | Alerts 10% hidden |
| --- | --- | --- | --- | --- | --- | --- |
| polish | 17 | mixture | 0.704 | 0.605 | 0.509 | 12.2% |
| polish | 42 | mixture | 0.622 | 0.526 | 0.461 | 12.9% |
| polish | 2026 | clean | 0.628 | 0.523 | 0.461 | 14.7% |
| taiwan | 17 | clean | 0.510 | 0.469 | 0.342 | 12.5% |
| taiwan | 42 | none | 0.554 | 0.512 | 0.489 | 8.7% |
| taiwan | 2026 | none | 0.556 | 0.506 | 0.450 | 10.7% |

**This mitigation uses test sets already examined and is exploratory.** The next confirmation requires a fresh holdout. It does not cover non-random missingness, erroneous invoices, stale information or sector changes. All results are kept even when they get worse.

In Poland, the mitigation raised AP at 10% hidden from 0.399–0.491 to 0.523–0.605, but reduced AP on clean data from 0.814–0.845 to 0.622–0.704. That is a considerable cost: replacing the original model automatically is not recommended. In Taiwan an exploratory AP improvement was obtained, pending independent confirmation.

Inference provisionally blocks above 20% unknown variables; that limit is precautionary, not validated. Any integrity problem triggers a request for reconciliation; an unknown balance is never replaced with zero. No automatic alert is enabled in production. To measure an abstention policy, both its precision and its coverage and unevaluated crises must be published; we have not measured those metrics in real operation.

## 3. Simulator, Monte Carlo and breaking point

**Every value in this section is synthetic, in MXN.** Opening balance $660,000; project of $800,000, costs of $560,000; horizon 180 days. Base collections of $320,000 every 30 days from day 20; payroll of $120,000 every 15 days; suppliers $60,000 every 30 days from day 10. Project costs: $380,000 on day 0 and $90,000 on days 30 and 60. Nominal delivery on day 30 and collection 30 days later.

Monte Carlo uses a common shock linking delivery delay, collection delay, lower sales and higher costs. The parameters were chosen as assumptions; they were not estimated from companies. The same worlds are used to compare actions. Each final comparison contains 20,000 futures distinct from the 20,000 used to search for the advance payment.

| Action | Gaps / 20,000 | Gap frequency | 95% CI, Monte Carlo only | Mean gap | 95th percentile gap |
| --- | --- | --- | --- | --- | --- |
| base | 0 | 0.0% | [0.0%, 0.0%] | $0 | $0 |
| project_without_reinforcement | 9380 | 46.9% | [46.2%, 47.6%] | $48,803 | $195,558 |
| advance_20 | 1945 | 9.7% | [9.3%, 10.1%] | $4,844 | $35,558 |
| advance_40 | 62 | 0.3% | [0.2%, 0.4%] | $145 | $0 |
| milestones | 5120 | 25.6% | [25.0%, 26.2%] | $13,086 | $75,649 |
| staggered_purchase | 12214 | 61.1% | [60.4%, 61.7%] | $64,534 | $211,743 |
| gradual_hiring | 12296 | 61.5% | [60.8%, 62.2%] | $59,750 | $200,831 |
| minimum_advance | 916 | 4.6% | [4.3%, 4.9%] | $2,085 | $0 |

The minimum advance payment on the one-percentage-point grid was **25.0% ($200,000)**, using as the search condition that the Wilson upper bound on gaps be ≤5%. The subsequent independent verification is shown above. A 95th percentile equal to zero does not mean zero risk: gaps may still occur in fewer than 5% of futures.

Staggered purchasing adds 3% to material cost and 7 days to delivery. Gradual hiring preserves cost, defers payments by 15 days and adds 10 days to delivery. Milestones collect 50% of the outstanding balance at an earlier milestone and 50% at the end. The advance payment does not increase total revenue; it is assumed to carry no discount. Negotiation, client acceptance and contractual feasibility were not validated. These trade-offs explain why an intuitive recommendation can turn out worse.

### Sensitivity to assumptions

| Variability multiplier | Gaps without reinforcement | Gaps with the chosen advance |
| --- | --- | --- |
| 0.5 | 41.7% | 0.0% |
| 1 | 46.8% | 4.2% |
| 1.5 | 48.7% | 12.3% |
| 2 | 49.4% | 18.6% |

Protection depends on the assumed distribution. Narrow Monte Carlo intervals do not cover the error of choosing the wrong distributions, unmodelled crises or data errors. This frequency is not averaged with CatBoost.

In the deterministic case, the first additional collection delay that opens a gap is **16 days**: first obligation **payroll on day 75**, gap $40,000. At 15 days the collection arrives on the same day as payroll and covers it, under the assumption that inflows are available before payments. The search evaluates the whole grid; it does not presuppose monotonicity of a general graph.

Other univariate limits, each holding everything else at nominal: sales drop 10.0%; cost increase 7.0%. Resolution: one percentage point. These are not simultaneous tolerances.

### The explanation the 3D structure can show

> Synthetic scenario: the collection arrives on day 80, after the payroll on day 75. $40,000 is missing. An advance payment of $200,000 eliminates this gap in that scenario.

Path: delivery → invoice → collection → cash → payroll. Nodes are recorded once across six stacks. The backend supplies path, first obligation, amounts and relative dates. The representation neither computes risk nor attributes new causality. Some graph edges are documented rules not yet implemented in the demo; they are marked as such.

## 4. Controls executed and what they actually cover

30 engine tests and 6 evaluation tests check duplicates, conflicts, full and partial reconciliation, unknown data, future information, payment ordering, cash conservation, advance payment without duplicating revenue, dependent delays, breaking boundary, repeatability, unique nodes, notice grouping, escalation and urgency. Logs are delivered.

The seasonal-expense case checks a known explicit commitment. It is not a trained seasonality detector. Synthetic persistence reduces logical duplication; we do not know its false-alarm rate per company-month nor its real effect on anticipation. The obligations interface requires canonical reconciliation; there are still no banking connectors, CFDI import or automatic multi-source reconciliation.

## 5. What is missing, how to mitigate it and what it would demonstrate

| Outstanding | Concrete strategy | Evidence required |
| --- | --- | --- |
| Transporting the model to the target population | Agree on event/horizon; harmonize ratios and units; freeze the model before external testing | Compatible independent dataset; retraining in Taiwan is not enough |
| Temporal validation | Store company_id, cut-off date, availability date and event date; evaluate future cut-offs without using later data | Real histories; purge labels whose horizon crosses the split; for 90 days, a 90-day label gap |
| Generalization to new companies | Separate whole companies between development and external testing; evaluate future follow-up of known companies separately | Stable IDs, corporate groups and links; exact deduplication is insufficient |
| Payroll shortfall at 30/60/90 days | Define uncovered contractual payment and distinguish delay, rescue and effective payment; train a model per event/horizon | Calendars, balances, due dates, payments and real outcomes; without substituting bankruptcy labels |
| Seasonality/extraordinary items | Categorize annual purchases, dividends and seasons; compare equivalent periods and use dated commitments | Series covering complete cycles and business justifications; the current test is only mechanical |
| Stale data | Per-source synchronization stamp and reconciliation before issuing a computation; record the age of every datum | Historical simulations using exactly what was available at the time |
| Missing data | Training augmentation and integrity review; evaluate abstention with coverage and omitted crises | Fresh holdout with real missingness patterns, not only MCAR |
| Threshold and calibration | Choose costs/tolerance and calibration during development; freeze the policy; monitor curves and total alerts | Sample from the target population and false-alarm/miss costs, not a universal threshold |
| Repeated alerts | Key of company + obligation + episode; persistence for non-urgent ones; notify on new severity or imminent due date | Episode tracking: alerts per company-month, precision, anticipation and coverage |
| Effect of the recommendations | Record action offered, accepted, date, cost, emergency credit, capital contributions and renegotiations | Prospective observation and then causal design; avoid counting rescues as false alarms without context |

In observation mode, risks would be computed without being sent as collapse alarms. For 90-day events, each cut-off needs 90 days of follow-up; a one-year bankruptcy requires the full annual horizon. Sample size must be planned by events and interval precision, not only by number of companies. We do not invent a number of months or companies that would guarantee validity.

## 6. Suggested text for presentation

> We built a reproducible prototype combining a predictive bankruptcy alert with an independent cash simulator. Across three splits of the Polish benchmark, CatBoost achieved AP of 0.814–0.845, against 0.685–0.724 for logistic regression. Limiting alerts to roughly 5% of the sample, 86.6–91.8% of alerts corresponded to bankruptcies, detecting 54.9–70.7% of events. These are benchmark results with random splits, not validation in Mexico. On synthetic scenarios, the simulator identifies the uncovered obligation and compares reinforcements with their costs and delays. We found fragility under missing data and trialled an exploratory mitigation. The next step is temporal and prospective validation with SMEs in the target sector.

The real alert rate of that policy ranged between 4.2% and 5.7%. Do not use the high precision alone without disclosing the missed bankruptcies. Do not promise "90% precision", "predicts payroll" or "prevents bankruptcies" on this evidence. The original 73/8/109/980 matrix is kept as user context; there is no paired comparison against that model.

## Sources and reproducibility

- [UCI: Polish Companies Bankruptcy](https://archive.ics.uci.edu/dataset/365/polish%2B): 5year file, ratios and horizon.
- [UCI: Taiwanese Bankruptcy Prediction](https://archive.ics.uci.edu/dataset/572/taiwanese%2Bbankruptcy%2Bprediction): population and variables of the second trial.
- [CatBoost: missing values processing](https://catboost.ai/docs/en/concepts/algorithm-missing-values-processing).
- [scikit-learn: calibration](https://scikit-learn.org/stable/modules/calibration.html): separation of calibration and limits of Brier.

The numerical results are local computations from this delivery. See `README.md`, protocols, scripts, requirements, data hashes, split indices, predictions, models and logs. No production integration is delivered, nor validation that would require non-existent data.
