from pathlib import Path
import json

def assert_accessible(page, repo, name):
    page.add_script_tag(path=str(repo / 'client/node_modules/axe-core/axe.min.js'))
    violations = page.evaluate("""async () => (await axe.run(document, {
        runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}
    })).violations.map(v => ({id: v.id, impact: v.impact,
        nodes: v.nodes.map(n => ({target: n.target, summary: n.failureSummary}))}))""")
    artifacts = repo / 'e2e/artifacts'
    artifacts.mkdir(exist_ok=True)
    (artifacts / (name + '-a11y.json')).write_text(json.dumps(violations, ensure_ascii=False, indent=2))
    assert not violations, violations
