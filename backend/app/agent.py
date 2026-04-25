import json
import os

from .config import DEBUG, ENV, run_preflight

run_preflight()

from anthropic import Anthropic

from .tools import SYSTEM, TOOLS, run_tool

client = Anthropic(api_key=ENV.get("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))


def _agent_turn(messages: list, state: dict, emit=None) -> tuple[list, dict]:
    """Run Claude tool-use loop until end_turn. emit(dict) is called for assistant
    text, tool_use, and tool_result events. If emit is None, falls back to print()."""

    def _emit(ev: dict):
        if emit is not None:
            emit(ev)
            return
        if ev["type"] == "text":
            print(ev["text"])
        elif ev["type"] == "tool_use":
            if DEBUG:
                print(f"   · {ev['name']}({json.dumps(ev['input'])})")
            else:
                print(f"   · {ev['name']}")
        elif ev["type"] == "tool_result" and DEBUG:
            print(f"     {json.dumps(ev['result'])}")

    while True:
        resp = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        for block in resp.content:
            if block.type == "text" and block.text:
                _emit({"type": "text", "text": block.text})

        if resp.stop_reason != "tool_use":
            messages.append({"role": "assistant", "content": resp.content})
            return messages, state

        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                _emit({"type": "tool_use", "name": block.name, "input": block.input})
                result = run_tool(block.name, block.input, state)
                _emit({"type": "tool_result", "name": block.name, "result": result})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})


def repl():
    print("diaspora agent — type 'exit' to quit")
    messages: list = []
    state: dict = {}
    while True:
        try:
            user_msg = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user_msg:
            continue
        if user_msg.lower() in {"exit", "quit"}:
            break
        if user_msg.lower() in {"yes", "y"}:
            state["user_confirmed"] = True
        messages.append({"role": "user", "content": user_msg})
        messages, state = _agent_turn(messages, state)


if __name__ == "__main__":
    repl()
