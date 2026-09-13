```dsl
DECISION D-001-0001
TICKET ticket-001
HEAD_SHA 3e195de57d77426021e537dcd3243d41899529ad
CORRELATION_ID taskand-audit-20260913-runtime
ACTOR agent:taskand
APPLIED_RULE P-CORE-016
INPUT decision_scope = "LOCAL_DETERMINISTIC_CHECK_ONLY_NOT_TRUSTED_APPROVAL"
INPUT required_checks = ["governance"]
INPUT observed_checks = ["governance=FAIL"]
INPUT governance_report = {"findings":[{"code":"GOV-BASE-001","evidence":{"allowedTargets":["main"]},"message":"Ticket ticket-001 targets unapproved branch 'refactor/phase-a'.","paths":["project/ticket-001/intent.json"],"remediation":"Choose a manifest-approved target branch and obtain fresh approval for its exact base SHA.","severity":"error"},{"code":"GOV-BUDGET-001","evidence":{"declaredRuntimeDependencies":[],"dependencyManifestPaths":[],"implementationFileLimit":15,"implementationFiles":21,"publicInterfacePaths":[],"touchedComponents":["gateway-context","governance","planner","runtime","verification"]},"message":"Actual diff for ticket-001 exceeds its approved complexity budget.","paths":[".gitignore",".governance/manifest.json",".governance/required-checks.json",".governance/ticket-allocation.json","Dockerfile","VERSION","bin/taskand","docker-compose.yaml","docs/README.md","docs/information/complementary-runtime.md","gateway/__init__.py","gateway/context.py","gateway/handlers/context.py","gateway/router.py","gateway/utils.py","generated/planner/plan/taskand.dev/v1/bin.mjs","generated/planner/registry.json","index.html","project.bat","project/lease-controller.py","tests/context_test.py"],"remediation":"Stop and split the remaining outcome into an explicitly dependent ticket; do not enlarge the current PR.","severity":"error"},{"code":"GOV-WORKSTREAM-003","evidence":{"ownedPaths":[".gitignore","project/lease-controller.py","gateway/context.py","gateway/__init__.py","gateway/utils.py","gateway/handlers/context.py","gateway/router.py","index.html","generated/planner/plan/taskand.dev/v1/bin.mjs","generated/planner/registry.json","tests/context_test.py","Dockerfile","docker-compose.yaml","bin/taskand",".governance/manifest.base.json",".governance/manifest.json",".governance/manifest.lock.json",".governance/package-manifest.json",".governance/required-checks.json",".governance/ticket-allocation.json",".subactor/manifest.json","AGENTS.md","VERSION","package.json","pyproject.toml","go.mod","Cargo.toml","pom.xml","docs/**","operations/**","events/**","error/**","models/**","proto/**"],"ticket":"ticket-001","workstream":"integration"},"message":"Changed paths are not owned by workstream 'integration'.","paths":["project.bat"],"remediation":"Move the change to its owning workstream or create and approve an integration ticket; do not widen ownership retroactively.","severity":"error"},{"code":"GOV-WORKSTREAM-003","evidence":{"concretePathCount":1,"ownedPaths":[".gitignore","project/lease-controller.py","gateway/context.py","gateway/__init__.py","gateway/utils.py","gateway/handlers/context.py","gateway/router.py","index.html","generated/planner/plan/taskand.dev/v1/bin.mjs","generated/planner/registry.json","tests/context_test.py","Dockerfile","docker-compose.yaml","bin/taskand",".governance/manifest.base.json",".governance/manifest.json",".governance/manifest.lock.json",".governance/package-manifest.json",".governance/required-checks.json",".governance/ticket-allocation.json",".subactor/manifest.json","AGENTS.md","VERSION","package.json","pyproject.toml","go.mod","Cargo.toml","pom.xml","docs/**","operations/**","events/**","error/**","models/**","proto/**"],"ticket":"ticket-001","unownedPatterns":[".cursor/**",".githooks/**",".github/**",".governance/**","project.bat","project/governance-check.*"],"workstream":"integration"},"message":"Ticket ticket-001 claims paths outside workstream 'integration'.","paths":[".cursor/**",".githooks/**",".github/**",".governance/**","project.bat","project/governance-check.*"],"remediation":"Narrow allowedPaths or route the paths to their owning workstream/integration ticket and obtain fresh approval.","severity":"error"}],"root":".","runtimeVersion":"0.11.0","schema":"new-project.governance-report/v1","status":"failed","summary":{"errors":4,"findings":4,"warnings":0}}
INPUT publication_requested = false
VERDICT REQUEST_CHANGES AUTHORITY DETERMINISTIC
REJECTED APPROVE BECAUSE REQUIRED_GOVERNANCE_GATE_FAILED
ASSERT LOCAL_CHECK_DOES_NOT_AUTHORIZE_EDIT_DEPLOYMENT_OR_MERGE
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-001-0002
TICKET ticket-001
HEAD_SHA 3e195de57d77426021e537dcd3243d41899529ad
CORRELATION_ID taskand-mesh-observation-20260913
ACTOR agent:taskand
APPLIED_RULE P-CORE-016
INPUT decision_scope = "LOCAL_DELIVERY_CHECK_ONLY_NOT_TRUSTED_APPROVAL"
INPUT required_checks = ["governance", "full-tests", "python-tests"]
INPUT observed_checks = ["governance=FAIL", "full-tests=INTERRUPTED", "python-tests=PASS"]
INPUT governance_errors = 9
INPUT governance_report_sha256 = "9ebbd8766f82d4949c3ff00f3e788c888432c4828a2d6668a49b94579b101dde"
INPUT python_tests_passed = 50
INPUT python_tests_log_sha256 = "356dc33ed78f03f0a21a797f907c8fe6a137eeafb5483e1de1ff7940be81dd9a"
INPUT evidence_ref = "receipt:taskand/audits/mesh-observer-20260913.IImMFd"
INPUT publication_requested = true
VERDICT REQUEST_CHANGES AUTHORITY DETERMINISTIC
REJECTED APPROVE BECAUSE REQUIRED_GOVERNANCE_GATE_FAILED_AND_FULL_TESTS_NOT_PASSED
ASSERT LOCAL_CHECK_DOES_NOT_AUTHORIZE_DEPLOYMENT_OR_MERGE
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-001-0003
TICKET ticket-001
HEAD_SHA 3e195de57d77426021e537dcd3243d41899529ad
CORRELATION_ID taskand-reconciliation-20260913
ACTOR agent:taskand
APPLIED_RULE P-CORE-016
INPUT decision_scope = "LOCAL_DELIVERY_CHECK_ONLY_NOT_TRUSTED_APPROVAL"
INPUT required_checks = ["governance", "scoped-regressions"]
INPUT observed_checks = ["governance=FAIL", "scoped-regressions=PASS"]
INPUT governance_errors = 9
INPUT governance_report_sha256 = "ebcb1d0d26e775b54becc3590572dc36cdadc232e188b50bc3274b64b6e3b81d"
INPUT evidence_ref = "receipt:taskand/audits/reconciliation-20260913.SYpaAP/taskand-governance.json"
INPUT publication_requested = true
VERDICT REQUEST_CHANGES AUTHORITY DETERMINISTIC
REJECTED APPROVE BECAUSE REQUIRED_GOVERNANCE_GATE_FAILED
ASSERT SCOPED_TESTS_DO_NOT_REPLACE_GOVERNANCE_OR_INDEPENDENT_CI
ASSERT LOCAL_CHECK_DOES_NOT_AUTHORIZE_DEPLOYMENT_OR_MERGE
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-001-0004
TICKET ticket-001
HEAD_SHA 3e195de57d77426021e537dcd3243d41899529ad
CORRELATION_ID taskand-operational-recovery-20260913
ACTOR agent:taskand
APPLIED_RULE P-CORE-016
INPUT decision_scope = "LOCAL_DETERMINISTIC_CHECK_ONLY_NOT_TRUSTED_APPROVAL"
INPUT required_checks = ["history-governance", "worktree-overlap"]
INPUT observed_checks = ["history-governance=FAIL", "worktree-overlap=FAIL"]
INPUT governance_report_sha256 = "6698cd6a2b78576f253c89c2923ae32178a7e012ec37a49f1b1cbcefab15e9d9"
INPUT overlap_report_sha256 = "18ea1e5325eb82f07309c28dc6f650d35c620dff5e51c5de68a7a50735335087"
INPUT publication_requested = true
VERDICT REQUEST_CHANGES AUTHORITY DETERMINISTIC
REJECTED APPROVE BECAUSE REQUIRED_CHECKS_FAILED
ASSERT BACKLOG_TICKET_002_DOES_NOT_AUTHORIZE_ANOTHER_WRITER
ASSERT LOCAL_CHECK_DOES_NOT_AUTHORIZE_DEPLOYMENT_OR_MERGE
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-001-0005
TICKET ticket-001
HEAD_SHA 3e195de57d77426021e537dcd3243d41899529ad
CORRELATION_ID taskand-recovery-snapshot-20260913
ACTOR agent:taskand
APPLIED_RULE P-CORE-016
INPUT decision_scope = "LOCAL_CHECK_REPLAY_ONLY_NEVER_TRUSTED_REVIEW_OR_RECOVERY_PUSH_AUTHORIZATION"
INPUT required_checks = ["governance", "independent-exact-head-validation"]
INPUT observed_checks = ["governance=FAILED", "independent-exact-head-validation=WAITING"]
INPUT user_authorized_recovery_effects = ["one-preserved-snapshot-commit", "ticket-branch-push", "draft-pull-request"]
INPUT user_forbidden_recovery_effects = ["merge", "release", "deployment", "force-push", "data-deletion"]
INPUT recovery_archive_sha256 = "25af843ab82f0b3cdec52542f801f069650f480e3cf51d88eafa5034ca77c447"
INPUT normal_publication_failure_log_sha256 = "45fdf38a8095340eec726bfe04d1cb6bf626302f92690fc13c58c51a91d29828"
VERDICT REQUEST_CHANGES AUTHORITY DETERMINISTIC
REJECTED APPROVE BECAUSE REQUIRED_GOVERNANCE_FAILED_AND_INDEPENDENT_VALIDATION_WAITING
ASSERT RECOVERY_PUSH_EXCEPTION_DOES_NOT_GRANT_MERGE_APPROVAL
ASSERT THIS_RECORD_IS_NOT_THE_SOURCE_OF_USER_AUTHORITY
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```
