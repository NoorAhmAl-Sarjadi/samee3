package app.samee3.quran;

import android.content.Context;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class QuranData {
    public static final String[] IDS={"hafs","warsh","qalun","douri","shubah","sousi","bazzi"};
    public static final String[] NAMES={"حفص عن عاصم","ورش عن نافع","قالون عن نافع","الدوري عن أبي عمرو","شعبة عن عاصم","السوسي عن أبي عمرو","البزي عن ابن كثير"};
    public final String id,name,bismillah;
    public final JSONArray pages,surahs,juzStarts;
    private static final LinkedHashMap<String,QuranData> CACHE=new LinkedHashMap<>(3,0.75f,true);
    private QuranData(JSONObject json)throws JSONException {
        id=json.getString("id");name=json.getString("name");bismillah=json.optString("bismillah");
        pages=json.getJSONArray("pages");surahs=json.getJSONArray("surahs");juzStarts=json.getJSONArray("juzStarts");
        if(pages.length()!=604||surahs.length()!=114||juzStarts.length()!=30)throw new JSONException("Incomplete Quran source");
    }
    public static synchronized QuranData load(Context context,String id)throws Exception {
        if(!Arrays.asList(IDS).contains(id))throw new IllegalArgumentException("Unsupported reading");
        if(CACHE.containsKey(id))return CACHE.get(id);
        QuranData value=new QuranData(new JSONObject(read(context.getAssets().open("content/"+id+".json"))));
        CACHE.put(id,value);while(CACHE.size()>2)CACHE.remove(CACHE.keySet().iterator().next());return value;
    }
    public String surahName(int number){return surahs.optJSONObject(number-1).optString("name");}
    public static String read(InputStream input)throws IOException {
        try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] block=new byte[16384];int count;while((count=in.read(block))!=-1)out.write(block,0,count);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
    public static String fold(String value){
        return value.replace("ٰ","ا").replaceAll("[\\p{M}ـ\\u200c\\u200d\\ufeff]","")
            .replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ٱ','ا').replace('ى','ي').replace('ؤ','و').replace('ئ','ي').replaceAll("\\s+"," ").trim();
    }
    public static JSONArray audio(Context context,String id)throws Exception {
        return new JSONObject(read(context.getAssets().open("audio-catalog.json"))).getJSONArray(id);
    }
}
