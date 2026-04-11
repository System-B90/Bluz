import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { postgresDb } from '@/api-server/curriculum';
import { curriculumSyllabuses, syllabuses } from '@/api-server/curriculum/schema';

// PATCH: Update an existing syllabus (e.g., change title or hiveIds)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; }; }
)
{
  try
  {
    const syllabusId = params.id;
    const body = await request.json();

    // Extract only the fields we allow to be updated
    const { title, hiveIds } = body;

    if (!title && !hiveIds)
    {
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    // Perform the update
    const updatedSyllabus = await postgresDb.update(syllabuses)
      .set({
        ...(title && { title }),
        ...(hiveIds && { hiveIds })
      })
      .where(eq(syllabuses.id, syllabusId))
      .returning(); // .returning() asks Postgres to return the updated row

    if (updatedSyllabus.length === 0)
    {
      return NextResponse.json({ error: 'Syllabus not found' }, { status: 404 });
    }

    return NextResponse.json(updatedSyllabus[ 0 ], { status: 200 });

  } catch (error)
  {
    console.error("Failed to update syllabus:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Remove a syllabus
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; }; }
)
{
  try
  {
    const syllabusId = params.id;

    // Use a transaction to ensure clean deletion
    await postgresDb.transaction(async (tx) =>
    {
      // 1. Remove the links in the junction table first 
      // (Postgres will block deletion if foreign keys exist, unless you configured ON DELETE CASCADE in schema)
      await tx.delete(curriculumSyllabuses)
        .where(eq(curriculumSyllabuses.syllabusId, syllabusId));

      // Note: You would also need to delete or unlink associated Modules here 
      // depending on your exact business logic. 

      // 2. Delete the actual syllabus
      await tx.delete(syllabuses)
        .where(eq(syllabuses.id, syllabusId));
    });

    return NextResponse.json({ message: 'Syllabus deleted successfully' }, { status: 200 });

  } catch (error)
  {
    console.error("Failed to delete syllabus:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
