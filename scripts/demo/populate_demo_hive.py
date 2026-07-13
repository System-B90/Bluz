import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from random import randint, shuffle

# Force UTF-8 stdout/stderr to avoid charmap encoding errors on Windows
if sys.platform.startswith("win"):
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import tqdm
from dotenv import load_dotenv
from pyhive import HiveClient
from pyhive.src.types.enums.class_type_enum import ClassTypeEnum
from pyhive.types import ClearanceEnum, GenderEnum


@dataclass
class UserData:
    first_name: str
    last_name: str
    gender: GenderEnum
    username: str


MOCK_STUDENTS: list[UserData] = []

MOCK_SEGEL: list[UserData] = [
    UserData(
        first_name="מיכאל",
        last_name="שטיינברג",
        gender=GenderEnum.MALE,
        username="test-michaelks",
    ),
    UserData(
        first_name="יובל",
        last_name="ברוורמן",
        gender=GenderEnum.FEMALE,
        username="test-yuvalb",
    ),
    UserData(
        first_name="מאיה",
        last_name="גבע",
        gender=GenderEnum.FEMALE,
        username="test-mayag",
    ),
]


MOCK_ADMINS: list[UserData] = [
    UserData(
        first_name="מיכאל",
        last_name="שטיינברג",
        gender=GenderEnum.MALE,
        username="michaelks",
    ),
    UserData(
        first_name="עומר",
        last_name="בלס",
        gender=GenderEnum.MALE,
        username="omerb",
    ),
    UserData(
        first_name="ירדן",
        last_name="דרור",
        gender=GenderEnum.MALE,
        username="yardend",
    ),
    UserData(
        first_name="גל",
        last_name="אסף",
        gender=GenderEnum.MALE,
        username="gassi",
    ),
]


@dataclass
class ProgramData:
    name: str


MOCK_PROGRAMS: list[ProgramData] = [
    ProgramData(name="Bis90"),
]


@dataclass
class ModuleData:
    name: str


@dataclass
class SubjectData:
    name: str
    symbol: str
    color: str
    modules: list[ModuleData] | None = None


MOCK_SUBJECTS: list[SubjectData] = [
    SubjectData(
        name="קפה",
        symbol="קפ",
        color="#4f46e5",
        modules=[
            ModuleData(name="קפה שבוע 1"),
            ModuleData(name="קפה שבוע 2"),
            ModuleData(name="קפה שבוע 3"),
            ModuleData(name="כללי"),
        ],
    ),
    SubjectData(
        name="סימולציות",
        symbol="סי",
        color="#06b6d4",
        modules=[
            ModuleData(name="מקתגים"),
            ModuleData(name="מקרי קצה"),
        ],
    ),
    SubjectData(
        name="גיבוש",
        symbol="גי",
        color="#10b981",
        modules=[
            ModuleData(name="גיבוש פתיחה קורסי)"),
            ModuleData(name="גיבוש פתיחה ביסי)"),
            ModuleData(name="משחקים"),
            ModuleData(name="תזים"),
            ModuleData(name="סכמש"),
            ModuleData(name="אחידות"),
            ModuleData(name="שעות מקס"),
        ],
    ),
    SubjectData(
        name="פיקוד אישי",
        symbol="פא",
        color="#f59e0b",
        modules=[
            ModuleData(name="תדריכים לתקשורת עם חניכים"),
            ModuleData(name="חניכי קצה"),
            ModuleData(name="תקשורת עם הורים"),
            ModuleData(name="תחקיר"),
            ModuleData(name="פיקוד מגדרי"),
            ModuleData(name="משמעת וענישה"),
            ModuleData(name="מבוא לחניך"),
            ModuleData(name="תפיסות תפקיד"),
            ModuleData(name="פאים"),
        ],
    ),
    SubjectData(
        name="סיסטם ובינוי",
        symbol="סו",
        color="#ef4444",
        modules=[
            ModuleData(name="סיסטם"),
            ModuleData(name="בינוי"),
            ModuleData(name="שבוע טקטי"),
            ModuleData(name="מטווחים"),
        ],
    ),
    SubjectData(
        name="פיקוד הדרכתי",
        symbol="פה",
        color="#8b5cf6",
        modules=[
            ModuleData(name="כללי"),
            ModuleData(name="מישוב"),
            ModuleData(name="פיתוח הסגל"),
        ],
    ),
    SubjectData(
        name="בירוקרטיה ושוטף",
        symbol="בו",
        color="#ec4899",
        modules=[
            ModuleData(name="קליטה"),
            ModuleData(name="שיבוצים"),
            ModuleData(name="אג"),
            ModuleData(name="קמפוס דאוס"),
            ModuleData(name="חלוקת חניכים"),
        ],
    ),
    SubjectData(
        name="מורשת ביס",
        symbol="מב",
        color="#14b8a6",
        modules=[
            ModuleData(name="הכרת הביס"),
            ModuleData(name="הכרת חוץ ביס"),
            ModuleData(name="דמויות הבוגרים"),
        ],
    ),
    SubjectData(
        name="עבודה על מקצועות",
        symbol="עמ",
        color="#f97316",
        modules=[
            ModuleData(name="מקצועות"),
            ModuleData(name="נקודות בקרה"),
            ModuleData(name="סדנאות"),
        ],
    ),
]


@dataclass
class ClassData:
    name: str


MOCK_CLASSES: list[ClassData] = [
    ClassData(name="תל אביב"),
    ClassData(name="רמת גן"),
    ClassData(name="גבעתיים"),
    ClassData(name="פתח תקווה"),
    ClassData(name="ים המלח"),
]


def clean_existing_data(client: HiveClient):
    for exercise in tqdm.tqdm(client.get_exercises(), desc="Deleting Exercises"):
        try:
            client.delete_exercise(exercise)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting exercise: {ex}")

    for module in tqdm.tqdm(client.get_modules(), desc="Deleting Modules"):
        try:
            client.delete_module(module)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting module: {ex}")

    for class_ in tqdm.tqdm(client.get_classes(), desc="Deleting Classes"):
        try:
            client.delete_class(class_)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting class: {ex}")

    for subject in tqdm.tqdm(client.get_subjects(), desc="Deleting Subjects"):
        try:
            client.delete_subject(subject)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting subject: {ex}")

    for program in tqdm.tqdm(client.get_programs(), desc="Deleting Programs"):
        try:
            client.delete_program(program)
        except Exception as ex:
            tqdm.tqdm.write(f"Error deleting program: {ex}")

    for user in tqdm.tqdm(client.get_users(), desc="Deleting Users"):
        if user.username != "admin" and user.clearance != ClearanceEnum.ADMIN:
            try:
                client.delete_user(user)
            except Exception as ex:
                tqdm.tqdm.write(f"Error deleting user {user.username}: {ex}")


def create_students(client: HiveClient):
    classes = list(client.get_classes())
    programs = list(client.get_programs())
    mentors = list(client.get_users(clearance__in=[ClearanceEnum.SEGEL]))

    for number, student_data in tqdm.tqdm(
        enumerate(MOCK_STUDENTS, start=4),
        total=len(MOCK_STUDENTS),
        desc="Creating Students",
        unit="student",
    ):
        shuffle(classes)
        shuffle(programs)

        class_count = randint(0, len(classes))
        try:
            client.create_student(
                f"test-hanich-{number}",
                "test",
                gender=student_data.gender,
                number=number,
                first_name=student_data.first_name,
                last_name=student_data.last_name,
                classes=classes[0:class_count],
                program=programs[randint(0, len(programs) - 1)],
                mentor=mentors[randint(0, len(mentors) - 1)],
            )
        except Exception as ex:
            tqdm.tqdm.write(str(ex))


def create_segel(client: HiveClient):
    for segel_data in tqdm.tqdm(MOCK_SEGEL, desc="Creating Segel", unit="segel"):
        try:
            client.create_user(
                segel_data.username,
                "test",
                gender=segel_data.gender,
                first_name=segel_data.first_name,
                last_name=segel_data.last_name,
                clearance=ClearanceEnum.SEGEL,
            )
        except Exception as ex:
            tqdm.tqdm.write(str(ex))


def create_admins(client: HiveClient):
    existing_admins = list(client.get_users(clearance__in=[ClearanceEnum.ADMIN]))
    existing_by_username = {u.username: u for u in existing_admins}

    for admin_data in tqdm.tqdm(MOCK_ADMINS, desc="Creating Admins", unit="admin"):
        if admin_data.username in existing_by_username:
            tqdm.tqdm.write(f"User '{admin_data.username}' already exists, reusing.")
            continue
        try:
            client.create_user(
                admin_data.username,
                "test",
                gender=admin_data.gender,
                first_name=admin_data.first_name,
                last_name=admin_data.last_name,
                clearance=ClearanceEnum.ADMIN,
            )
        except Exception as ex:
            tqdm.tqdm.write(str(ex))


def create_programs(client: HiveClient):
    liran = None
    try:
        checkers = list(client.get_users(clearance__in=[ClearanceEnum.CHECKER]))
        liran = next((u for u in checkers if u.username == "liran"), None)
        if liran:
            tqdm.tqdm.write("User 'liran' already exists, reusing.")
    except Exception as ex:
        tqdm.tqdm.write(f"Error checking existing liran: {ex}")

    if not liran:
        try:
            liran = client.create_user(
                "liran",
                "Password1",
                gender=GenderEnum.MALE,
                first_name="צ׳ק",
                last_name="רמן",
                clearance=ClearanceEnum.CHECKER,
            )
        except Exception as ex:
            tqdm.tqdm.write(f"Error creating liran: {ex}")
            try:
                checkers = list(client.get_users(clearance__in=[ClearanceEnum.CHECKER]))
                liran = next((u for u in checkers if u.username == "liran"), None)
            except Exception:
                pass
            if not liran:
                raise ex

    for program in tqdm.tqdm(MOCK_PROGRAMS, desc="Creating Programs", unit="program"):
        try:
            client.create_program(name=program.name, checker=liran)
        except Exception as ex:
            tqdm.tqdm.write(str(ex))


def create_subjects(client: HiveClient):
    programs = list(client.get_programs())
    for subject in tqdm.tqdm(MOCK_SUBJECTS, desc="Creating Subjects", unit="subject"):
        try:
            s = client.create_subject(
                name=subject.name,
                symbol=subject.symbol,
                color=subject.color,
                program=programs[0],
            )
            if not subject.modules:
                continue
            for index, module in tqdm.tqdm(
                enumerate(subject.modules, start=1),
                desc="  Creating Modules for {}".format(subject.name),
                total=len(subject.modules),
                unit="module",
            ):
                try:
                    client.create_module(
                        name=module.name, order=index, parent_subject=s
                    )
                except Exception as ex:
                    tqdm.tqdm.write(
                        " | ".join([str(ex), "Module Creation Error", module.name])
                    )
        except Exception as ex:
            tqdm.tqdm.write(
                str(" | ".join([str(ex), "Subject Creation Error", subject.name]))
            )


def create_classes(client: HiveClient):
    programs = list(client.get_programs())
    students = list(client.get_students())

    for class_ in tqdm.tqdm(MOCK_CLASSES, desc="Creating Classes", unit="class"):
        shuffle(students)
        try:
            client.create_class(
                program=programs[randint(0, len(programs) - 1)],
                name=class_.name,
                type_=ClassTypeEnum.ROOM,
                users=students[: randint(0, len(students))],
            )
        except Exception as ex:
            tqdm.tqdm.write(str(ex))


def main():
    # Load env file from the root directory (parent of parent of scripts/demo/)
    root_dir = Path(__file__).resolve().parents[2]
    load_dotenv(dotenv_path=root_dir / ".env")
    hive_url = os.getenv("NEXT_PUBLIC_HIVE_URL", "https://hive.org/")
    # Use direct password authentication to avoid interactive browser SSO in headless testing
    with HiveClient(
        "michaelks", "Password1", hive_url, verify=False, timeout=10
    ) as client:
        clean_existing_data(client)

        try:
            client.create_user(
                "api",
                "Password1",
                clearance=ClearanceEnum.SEGEL,
                gender=GenderEnum.MALE,
                first_name="Api",
                last_name="Account",
            )
        except Exception:
            pass

        create_segel(client)
        create_admins(client)

        create_programs(client)
        create_subjects(client)

        create_students(client)

        create_classes(client)

        # Collect generated info and write to JSON
        tqdm.tqdm.write("Collecting generated objects from Hive...")
        segel_users = list(client.get_users(clearance__in=[ClearanceEnum.SEGEL]))
        admin_users = list(client.get_users(clearance__in=[ClearanceEnum.ADMIN]))
        subjects = list(client.get_subjects())
        modules = list(client.get_modules())
        rooms = list(client.get_classes(type_=ClassTypeEnum.ROOM))

        export_data = {
            "segel": [
                {
                    "id": u.id,
                    "username": u.username,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                }
                for u in segel_users
            ],
            "admins": [
                {
                    "id": u.id,
                    "username": u.username,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                }
                for u in admin_users
            ],
            "subjects": [
                {
                    "id": s.id,
                    "name": s.name,
                    "symbol": s.symbol,
                    "color": s.color,
                }
                for s in subjects
            ],
            "modules": [
                {
                    "id": m.id,
                    "name": m.name,
                    "parent_subject_id": m.parent_subject_id,
                }
                for m in modules
            ],
            "rooms": [
                {
                    "id": r.id,
                    "name": r.name,
                }
                for r in rooms
            ],
        }

        json_path = Path(__file__).resolve().parent / "hive_data.json"
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        tqdm.tqdm.write(
            f"Successfully exported Hive structural metadata to {json_path}"
        )


if __name__ == "__main__":
    main()
