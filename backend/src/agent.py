import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    UserInputTranscribedEvent,
    cli,
    function_tool,
    room_io,
    tokenize,
)
from livekit.plugins import deepgram, google, murf, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from memory import lookup_caller, save_caller
from prompt import GREETING_MESSAGE, SYSTEM_PROMPT

logger = logging.getLogger("agent")

load_dotenv(".env.local")


def _caller_id_from_room(room_name: str) -> str | None:
    prefix = "sahaya_room_"
    if not room_name.startswith(prefix):
        return None

    caller_id, _, _suffix = room_name.removeprefix(prefix).rpartition("_")
    return caller_id or None


class Assistant(Agent):
    def __init__(self, caller_id: str | None = None) -> None:
        self.caller_id = caller_id
        super().__init__(instructions=SYSTEM_PROMPT)

    @function_tool
    async def lookup_caller_memory(self, context: RunContext) -> dict:
        """Look up the current caller's saved memory.

        Use this at the start of a call. If a record is found, greet the caller
        by name and continue from the saved disaster-response context.
        """

        if not self.caller_id:
            return {"found": False, "reason": "No stable caller ID is available."}

        logger.info("Looking up caller memory for %s", self.caller_id)
        record = lookup_caller(self.caller_id)
        if record is None:
            return {"found": False, "user_id": self.caller_id}

        return {"found": True, "record": record}

    @function_tool
    async def save_caller_memory(
        self,
        context: RunContext,
        name: str,
        consent_confirmed: bool,
        language_preference: str | None = None,
        location: str | None = None,
        household_size: str | None = None,
        mobility_needs: str | None = None,
        last_check_in: str | None = None,
    ) -> dict:
        """Save disaster-response facts for the current caller.

        Only call this after the caller clearly agrees that Sahaya may remember
        the details. If the caller refuses, do not call this tool.

        Args:
            name: Caller name.
            consent_confirmed: True only after explicit caller consent.
            language_preference: Hindi, Hinglish, English, or another preference.
            location: Caller location such as village, district, city, or shelter.
            household_size: Household size or number of people needing support.
            mobility_needs: Mobility, disability, elderly, child, pregnancy, or medical access needs.
            last_check_in: Short summary of the latest situation or safety check-in.
        """

        if not self.caller_id:
            return {"saved": False, "reason": "No stable caller ID is available."}

        if not consent_confirmed:
            return {"saved": False, "reason": "Caller did not consent to saving."}

        facts = {
            "location": location,
            "household_size": household_size,
            "mobility_needs": mobility_needs,
            "last_check_in": last_check_in,
        }
        cleaned_facts = {key: value for key, value in facts.items() if value}

        logger.info("Saving caller memory for %s", self.caller_id)
        record = save_caller(
            user_id=self.caller_id,
            name=name,
            language_preference=language_preference,
            facts=cleaned_facts,
        )
        return {"saved": True, "record": record}


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Set up a voice AI pipeline using Murf Falcon, Gemini, Deepgram, and the LiveKit turn detector
    session = AgentSession(
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=deepgram.STT(model="nova-3", language="multi"),
        # A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
        # See all available models at https://docs.livekit.io/agents/models/llm/
        llm=google.LLM(
            model="gemini-3.5-flash-lite",
        ),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=murf.TTS(
            voice="Anisha",
            locale="hi-IN",
            style="Conversation",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=True,
        ),
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # allow the LLM to generate a response while waiting for the end of turn
        # See more at https://docs.livekit.io/agents/build/audio/#preemptive-generation
        preemptive_generation=True,
    )

    # Detect language changes and dynamically update TTS locale & voice settings
    @session.on("user_input_transcribed")
    def on_user_input_transcribed(ev: UserInputTranscribedEvent):
        transcript = ev.transcript.strip().lower()
        if not transcript:
            return

        # 1. Check for Devanagari script characters (native Hindi)
        has_devanagari = any(0x0900 <= ord(c) <= 0x097F for c in transcript)

        # 2. Check for common Hinglish/Hindi romanized keywords
        hindi_keywords = {
            "kya",
            "hai",
            "aur",
            "main",
            "haan",
            "nahin",
            "aap",
            "namaste",
            "shukriya",
            "yojana",
            "batao",
            "bataiye",
            "samjhao",
            "dhan",
            "suraksha",
            "bima",
            "pension",
            "mein",
            "ke",
            "ki",
            "se",
            "ko",
            "ka",
            "jo",
            "toh",
            "bhi",
            "ho",
            "kar",
            "raha",
            "rahi",
            "rha",
            "rhi",
            "mujhe",
            "mera",
            "meri",
            "hum",
            "tum",
            "apna",
            "apni",
            "karke",
            "karo",
            "karna",
            "tha",
            "thi",
            "the",
            "ab",
            "kab",
            "tab",
            "sab",
        }
        words = set(transcript.split())
        has_hindi_keywords = not words.isdisjoint(hindi_keywords)

        if has_devanagari or has_hindi_keywords:
            # Switch TTS to Hindi locale and voice
            session.tts.update_options(locale="hi-IN", voice="Anisha")
        else:
            # Switch TTS to English (India) locale and voice
            session.tts.update_options(locale="en-IN", voice="Anisha")

    # To use a realtime model instead of a voice pipeline, use the following session setup instead.
    # (Note: This is for the OpenAI Realtime API. For other providers, see https://docs.livekit.io/agents/models/realtime/))
    # 1. Install livekit-agents[openai]
    # 2. Set OPENAI_API_KEY in .env.local
    # 3. Add `from livekit.plugins import openai` to the top of this file
    # 4. Use the following session setup instead of the version above
    # session = AgentSession(
    #     llm=openai.realtime.RealtimeModel(voice="marin")
    # )

    # # Add a virtual avatar to the session, if desired
    # # For other providers, see https://docs.livekit.io/agents/models/avatar/
    # avatar = hedra.AvatarSession(
    #   avatar_id="...",  # See https://docs.livekit.io/agents/models/avatar/plugins/hedra
    # )
    # # Start the avatar and wait for it to join
    # await avatar.start(session, room=ctx.room)

    caller_id = _caller_id_from_room(ctx.room.name)

    # Join the room and connect to the user
    await ctx.connect()

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=Assistant(caller_id=caller_id),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # Play first-turn greeting
    await session.say(GREETING_MESSAGE, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(server)
